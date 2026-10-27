"""
src/qbd_rag.py  –  QbD Knowledge Base & Regulatory RAG Engine
==============================================================
Implements local Retrieval-Augmented Generation (RAG) for Quality by Design standards:
1. Indexes curated regulatory knowledge from `data/qbd_knowledge/` covering:
   - ICH Q8(R2): QTPP, CQAs, CPPs, Design Space, NOR vs. PAR, Control Strategy, DoE in QbD.
   - ICH Q9(R1): Quality Risk Management, FMEA, Ishikawa Cause-and-Effect Matrix, RPN scoring, bias mitigation.
   - ICH Q10 & Q14: Pharmaceutical Quality System lifecycle, 4 PQS elements, Analytical Target Profile (ATP),
     Analytical QbD, Method Operable Design Region (MODR), Established Conditions (ECs).
2. Uses SQLite FTS5 (BM25 full-text search) combined with TF-IDF cosine similarity for fast, local, zero-dependency hybrid retrieval.
3. Exposes the tool:
   `query_qbd_regulatory_guidance(query: str, guideline: str = None)`
   returning precise regulatory definitions, compliance considerations, and formal citations.
"""

import os
import re
import sqlite3
from typing import Dict, List, Any, Optional, Tuple
import numpy as np

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


# =============================================================================
# 1. Regulatory Document Chunker & Parser
# =============================================================================

class QbDDocumentChunk:
    """Represents an indexed section or subsection of a QbD regulatory guideline."""
    def __init__(
        self,
        chunk_id: str,
        guideline: str,
        section_number: str,
        section_title: str,
        content: str,
        file_path: str,
        regulatory_definition: Optional[str] = None,
        compliance_considerations: Optional[str] = None,
        citation: Optional[str] = None
    ):
        self.chunk_id = chunk_id
        self.guideline = guideline
        self.section_number = section_number
        self.section_title = section_title
        self.content = content.strip()
        self.file_path = file_path
        self.regulatory_definition = regulatory_definition or ""
        self.compliance_considerations = compliance_considerations or ""
        self.citation = citation or f"{guideline}, Section {section_number}"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "guideline": self.guideline,
            "section": self.section_number,
            "title": self.section_title,
            "citation": self.citation,
            "regulatory_definition": self.regulatory_definition,
            "compliance_considerations": self.compliance_considerations,
            "content": self.content
        }


def _extract_definition_and_compliance(text: str) -> Tuple[str, str]:
    """Helper to extract distinct definitions and compliance considerations from text."""
    reg_def = ""
    compliance = ""

    # Look for definition markers
    def_match = re.search(
        r'(?:###?\s*(?:\d+\.\d+\s+)?(?:Regulatory\s+)?Definition[^\n]*\n)(.*?)(?=\n###?|\Z)',
        text,
        re.DOTALL | re.IGNORECASE
    )
    if def_match:
        reg_def = def_match.group(1).strip()
    else:
        # Fallback to lines with "is defined as" or "**Definition**:"
        def_lines = [
            line.strip() for line in text.split("\n")
            if "**definition**" in line.lower() or "is defined as" in line.lower()
        ]
        if def_lines:
            reg_def = " ".join(def_lines)

    # Look for compliance considerations markers
    comp_match = re.search(
        r'(?:###?\s*(?:\d+\.\d+\s+)?(?:Compliance\s+Considerations|Regulatory\s+Status|Regulatory\s+Comparison)[^\n]*\n)(.*?)(?=\n###?|\Z)',
        text,
        re.DOTALL | re.IGNORECASE
    )
    if comp_match:
        compliance = comp_match.group(1).strip()
    else:
        # Look for compliance keywords in paragraphs
        comp_paras = [
            p.strip() for p in text.split("\n\n")
            if any(k in p.lower() for k in ["compliance", "regulatory change", "excursion", "post-approval", "filing"])
        ]
        if comp_paras:
            compliance = "\n\n".join(comp_paras[:2])

    return reg_def, compliance


def parse_qbd_knowledge_directory(data_dir: str) -> List[QbDDocumentChunk]:
    """
    Parses all markdown files in data_dir into structured QbDDocumentChunk objects.
    """
    chunks: List[QbDDocumentChunk] = []

    if not os.path.isdir(data_dir):
        return chunks

    for filename in sorted(os.listdir(data_dir)):
        if not filename.endswith(".md"):
            continue

        file_path = os.path.join(data_dir, filename)
        with open(file_path, "r", encoding="utf-8") as f:
            full_text = f.read()

        # Determine primary guideline label
        if "ich_q8" in filename.lower():
            base_guideline = "ICH Q8(R2)"
            formal_title = "ICH Q8(R2) Pharmaceutical Development"
        elif "ich_q9" in filename.lower():
            base_guideline = "ICH Q9(R1)"
            formal_title = "ICH Q9(R1) Quality Risk Management"
        elif "ich_q10" in filename.lower():
            base_guideline = "ICH Q10 & ICH Q14"
            formal_title = "ICH Q10 (PQS) & ICH Q14 (Analytical Procedure Development)"
        else:
            base_guideline = filename.replace(".md", "").upper()
            formal_title = base_guideline

        # Split into main sections (## Section Heading)
        raw_sections = re.split(r'\n(?=##\s+)', full_text)
        doc_header = ""

        chunk_idx = 0
        for i, raw_sec in enumerate(raw_sections):
            raw_sec = raw_sec.strip()
            if not raw_sec:
                continue

            # If section doesn't start with ##, it's document title / preamble
            if not raw_sec.startswith("##"):
                doc_header = raw_sec
                continue

            header_match = re.match(r'##\s+(\d+(?:\.\d+)?\.?)\s*(.*?)(?:\n|$)', raw_sec)
            if header_match:
                sec_num = header_match.group(1).rstrip(".")
                sec_title = header_match.group(2).strip()
            else:
                title_match = re.match(r'##\s*(.*?)(?:\n|$)', raw_sec)
                sec_num = str(chunk_idx + 1)
                sec_title = title_match.group(1).strip() if title_match else f"Section {chunk_idx + 1}"

            chunk_idx += 1

            # If section belongs specifically to Q10 or Q14 within combined file
            curr_guideline = base_guideline
            if "ICH Q10" in sec_title or "PQS" in sec_title or "PART A" in doc_header:
                if "Q14" not in sec_title and "Analytical" not in sec_title and "MODR" not in sec_title and "ATP" not in sec_title:
                    curr_guideline = "ICH Q10"
            if "ICH Q14" in sec_title or "Analytical" in sec_title or "MODR" in sec_title or "ATP" in sec_title or "PART B" in doc_header:
                if "PQS" not in sec_title and "ICH Q10" not in sec_title:
                    curr_guideline = "ICH Q14"

            reg_def, compliance = _extract_definition_and_compliance(raw_sec)
            citation = f"{curr_guideline}, Section {sec_num} ({sec_title})"

            chunk_id = f"{filename.replace('.md', '')}_c{chunk_idx}_sec_{sec_num.replace('.', '_')}"

            chunk = QbDDocumentChunk(
                chunk_id=chunk_id,
                guideline=curr_guideline,
                section_number=sec_num,
                section_title=sec_title,
                content=raw_sec,
                file_path=file_path,
                regulatory_definition=reg_def,
                compliance_considerations=compliance,
                citation=citation
            )
            chunks.append(chunk)

    return chunks


# =============================================================================
# 2. QbD Retrieval Engine (SQLite FTS5 + Hybrid TF-IDF)
# =============================================================================

class QbDKnowledgeEngine:
    """
    Deterministic, high-performance local RAG engine for QbD regulatory guidance.
    Combines SQLite FTS5 (BM25 ranking) with scikit-learn TF-IDF cosine similarity.
    """
    def __init__(self, data_dir: Optional[str] = None, db_path: str = ":memory:"):
        if data_dir is None:
            # Locate data/qbd_knowledge relative to repository root
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
            data_dir = os.path.join(base_dir, "data", "qbd_knowledge")

        self.data_dir = data_dir
        self.db_path = db_path
        self.chunks: List[QbDDocumentChunk] = []
        self.chunks_by_id: Dict[str, QbDDocumentChunk] = {}

        # TF-IDF state
        self.vectorizer: Optional[Any] = None
        self.tfidf_matrix: Optional[Any] = None

        # Initialize SQLite database & index
        self._init_db()
        self.load_and_index()

    def _init_db(self):
        """Initializes SQLite connection and FTS5 virtual table."""
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        cursor = self.conn.cursor()

        # Regular metadata table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS qbd_chunks (
                chunk_id TEXT PRIMARY KEY,
                guideline TEXT,
                section_number TEXT,
                section_title TEXT,
                citation TEXT,
                content TEXT,
                regulatory_definition TEXT,
                compliance_considerations TEXT,
                file_path TEXT
            )
        """)

        # FTS5 full-text search table
        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS qbd_chunks_fts USING fts5(
                chunk_id UNINDEXED,
                guideline,
                section_title,
                content,
                regulatory_definition,
                compliance_considerations,
                tokenize='porter unicode61'
            )
        """)
        self.conn.commit()

    def load_and_index(self):
        """Parses documents from knowledge directory and indexes them in SQLite and TF-IDF."""
        self.chunks = parse_qbd_knowledge_directory(self.data_dir)
        self.chunks_by_id = {c.chunk_id: c for c in self.chunks}

        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM qbd_chunks")
        cursor.execute("DELETE FROM qbd_chunks_fts")

        for c in self.chunks:
            cursor.execute("""
                INSERT INTO qbd_chunks (
                    chunk_id, guideline, section_number, section_title, citation,
                    content, regulatory_definition, compliance_considerations, file_path
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                c.chunk_id, c.guideline, c.section_number, c.section_title, c.citation,
                c.content, c.regulatory_definition, c.compliance_considerations, c.file_path
            ))

            cursor.execute("""
                INSERT INTO qbd_chunks_fts (
                    chunk_id, guideline, section_title, content, regulatory_definition, compliance_considerations
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                c.chunk_id, c.guideline, c.section_title, c.content, c.regulatory_definition, c.compliance_considerations
            ))

        self.conn.commit()

        # Fit TF-IDF matrix for dense semantic retrieval
        if SKLEARN_AVAILABLE and self.chunks:
            corpus = [
                f"{c.guideline} {c.section_title}\n{c.regulatory_definition}\n{c.compliance_considerations}\n{c.content}"
                for c in self.chunks
            ]
            self.vectorizer = TfidfVectorizer(
                stop_words="english",
                ngram_range=(1, 2),
                sublinear_tf=True
            )
            self.tfidf_matrix = self.vectorizer.fit_transform(corpus)

    def _sanitize_fts_query(self, query: str) -> str:
        """Sanitizes raw query for safe, effective SQLite FTS5 matching."""
        # Replace non-alphanumeric characters with spaces
        clean_text = re.sub(r'[^a-zA-Z0-9_\s]', ' ', query)
        tokens = [t.strip() for t in clean_text.split() if len(t.strip()) > 1]
        if not tokens:
            return ""

        # Highlight key QbD acronyms
        acronyms = {"nor", "par", "qtpp", "cqa", "cpp", "cma", "fmea", "rpn", "atp", "modr", "q8", "q9", "q10", "q14"}
        matched_acronyms = [t for t in tokens if t.lower() in acronyms]

        # Combine with OR, but boost acronyms if present
        return " OR ".join(tokens)

    def search(
        self,
        query: str,
        guideline: Optional[str] = None,
        top_k: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Executes hybrid search combining SQLite FTS5 BM25 ranking and TF-IDF cosine similarity.
        """
        if not query or not query.strip():
            return []

        clean_query = query.strip()
        fts_query = self._sanitize_fts_query(clean_query)

        guideline_filter = None
        if guideline:
            g_clean = guideline.strip().upper()
            if "8" in g_clean:
                guideline_filter = "Q8"
            elif "9" in g_clean:
                guideline_filter = "Q9"
            elif "10" in g_clean:
                guideline_filter = "Q10"
            elif "14" in g_clean:
                guideline_filter = "Q14"
            else:
                guideline_filter = g_clean

        # 1. FTS5 BM25 search
        fts_scores: Dict[str, float] = {}
        if fts_query:
            try:
                cursor = self.conn.cursor()
                sql = """
                    SELECT chunk_id, bm25(qbd_chunks_fts) as rank
                    FROM qbd_chunks_fts
                    WHERE qbd_chunks_fts MATCH ?
                """
                cursor.execute(sql, (fts_query,))
                rows = cursor.fetchall()
                if rows:
                    # BM25 in sqlite gives negative numbers where lower is better
                    raw_ranks = [r["rank"] for r in rows]
                    min_r = min(raw_ranks)
                    max_r = max(raw_ranks)
                    span = (max_r - min_r) if max_r != min_r else 1.0

                    for r in rows:
                        # Normalize to [0.0, 1.0], higher is better
                        norm_score = 1.0 - ((r["rank"] - min_r) / span)
                        fts_scores[r["chunk_id"]] = float(norm_score)
            except Exception:
                # Fallback silently if query structure fails
                fts_scores = {}

        # 2. TF-IDF Cosine Similarity Search
        tfidf_scores: Dict[str, float] = {}
        if SKLEARN_AVAILABLE and self.vectorizer is not None and self.tfidf_matrix is not None:
            try:
                q_vec = self.vectorizer.transform([clean_query])
                cos_sims = cosine_similarity(q_vec, self.tfidf_matrix)[0]
                for idx, sim in enumerate(cos_sims):
                    chunk_id = self.chunks[idx].chunk_id
                    tfidf_scores[chunk_id] = float(sim)
            except Exception:
                tfidf_scores = {}

        # 3. Combine Hybrid Scores
        all_chunk_ids = set(self.chunks_by_id.keys())
        scored_candidates: List[Tuple[str, float]] = []

        # Check for query keyword priority (e.g. "NOR", "PAR" exact mentions)
        query_terms = set(re.findall(r'\b[a-zA-Z0-9_]+\b', clean_query.lower()))

        for cid in all_chunk_ids:
            chunk = self.chunks_by_id[cid]

            # Guideline filtering
            if guideline_filter:
                if guideline_filter not in chunk.guideline.upper() and guideline_filter not in chunk.citation.upper():
                    continue

            f_score = fts_scores.get(cid, 0.0)
            t_score = tfidf_scores.get(cid, 0.0)

            # Extra weight if key acronyms or exact titles appear
            title_terms = set(re.findall(r'\b[a-zA-Z0-9_]+\b', chunk.section_title.lower()))
            overlap = len(query_terms.intersection(title_terms))
            boost = 0.25 * overlap if overlap > 0 else 0.0

            # Hybrid formula
            if fts_scores and tfidf_scores:
                combined_score = (0.5 * f_score) + (0.5 * t_score) + boost
            elif fts_scores:
                combined_score = f_score + boost
            else:
                combined_score = t_score + boost

            scored_candidates.append((cid, combined_score))

        # Sort descending by score
        scored_candidates.sort(key=lambda x: x[1], reverse=True)

        results = []
        for cid, score in scored_candidates[:top_k]:
            chunk = self.chunks_by_id[cid]
            res_dict = chunk.to_dict()
            res_dict["relevance_score"] = round(min(float(score), 1.0), 4)
            results.append(res_dict)

        return results


# Global singleton engine instance
_ENGINE_INSTANCE: Optional[QbDKnowledgeEngine] = None


def get_qbd_engine() -> QbDKnowledgeEngine:
    """Returns cached singleton QbDKnowledgeEngine instance."""
    global _ENGINE_INSTANCE
    if _ENGINE_INSTANCE is None:
        _ENGINE_INSTANCE = QbDKnowledgeEngine()
    return _ENGINE_INSTANCE


# =============================================================================
# 3. Primary Callable Tool Function
# =============================================================================

def query_qbd_regulatory_guidance(
    query: str,
    guideline: Optional[str] = None
) -> Dict[str, Any]:
    """
    Deterministic retrieval tool for Quality by Design (QbD) standards and regulatory guidelines.
    Returns precise regulatory definitions, comparative analyses, compliance considerations, and citations.

    Parameters:
        query: Natural language question or regulatory term, e.g.:
               "What is the difference between Normal Operating Range (NOR) and Proven Acceptable Range (PAR) according to ICH Q8?"
        guideline: Optional guideline filter, e.g. "ICH Q8", "ICH Q9", "ICH Q10", "ICH Q14", or None for cross-guideline search.

    Returns:
        Structured dictionary containing:
        - status: "success" or "no_matches"
        - query: Original user query
        - guideline_filter: Applied guideline filter
        - total_results: Number of matched regulatory sections
        - top_citation: Primary formal regulatory citation
        - results: List of matched sections with definitions, compliance considerations, citations, and full text.
    """
    engine = get_qbd_engine()
    results = engine.search(query=query, guideline=guideline, top_k=3)

    if not results:
        return {
            "status": "no_matches",
            "query": query,
            "guideline_filter": guideline,
            "total_results": 0,
            "message": f"No regulatory guidance matched query '{query}'."
        }

    top_citation = results[0]["citation"]

    # Extract concise executive synthesis snippet
    top_def = results[0]["regulatory_definition"]
    top_comp = results[0]["compliance_considerations"]

    return {
        "status": "success",
        "query": query,
        "guideline_filter": guideline,
        "total_results": len(results),
        "top_citation": top_citation,
        "results": results,
        "summary": {
            "primary_topic": results[0]["title"],
            "citation": top_citation,
            "key_regulatory_definition": top_def if top_def else results[0]["content"][:300] + "...",
            "compliance_considerations": top_comp if top_comp else "Refer to full guideline text."
        }
    }


if __name__ == "__main__":
    # Interactive CLI verification
    test_q = "What is the difference between Normal Operating Range (NOR) and Proven Acceptable Range (PAR) according to ICH Q8?"
    res = query_qbd_regulatory_guidance(test_q, guideline="ICH Q8")
    print("\n--- QUERY RESULT ---")
    print(f"Top Citation: {res.get('top_citation')}")
    print(f"Total Results: {res.get('total_results')}")
    for i, r in enumerate(res.get("results", [])):
        print(f"\n[{i+1}] {r['citation']} (Score: {r['relevance_score']})")
        print(f"Title: {r['title']}")
        if r.get("regulatory_definition"):
            print(f"Definition:\n{r['regulatory_definition'][:250]}...")
