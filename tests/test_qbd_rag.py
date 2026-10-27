"""
tests/test_qbd_rag.py  –  Verification of QbD Regulatory RAG Module
===================================================================
Tests the local QbD Knowledge Base & Regulatory RAG engine:
1. Verifies direct retrieval for:
   "What is the difference between Normal Operating Range (NOR) and Proven Acceptable Range (PAR) according to ICH Q8?"
   and verifies accurate definitions and citation of ICH Q8(R2).
2. Verifies retrieval across ICH Q9(R1) (FMEA, RPN, Ishikawa), ICH Q10 (PQS elements), and ICH Q14 (ATP, AQbD).
3. Verifies tool registration and execution in `execute_tool`.
4. Verifies Groq agent orchestrator invoking `query_qbd_regulatory_guidance` and synthesizing regulatory response with accurate citations.
"""

import sys
import os
import json
from unittest.mock import MagicMock

# Add workspace root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from src.qbd_rag import (
    query_qbd_regulatory_guidance,
    get_qbd_engine,
    QbDKnowledgeEngine
)
from src.agent import (
    DoEAgent,
    execute_tool,
    DOE_TOOLS,
    SYSTEM_PROMPT
)
from backend.api.chat import handle_chat_execution, ChatRequest


# =============================================================================
# Test 1: Direct Regulatory RAG Query for NOR vs. PAR (ICH Q8)
# =============================================================================

def test_nor_vs_par_ich_q8_retrieval():
    """
    Test direct retrieval for:
    'What is the difference between Normal Operating Range (NOR) and Proven Acceptable Range (PAR) according to ICH Q8?'
    Asserts accurate citation and regulatory definitions.
    """
    prompt = "What is the difference between Normal Operating Range (NOR) and Proven Acceptable Range (PAR) according to ICH Q8?"
    result = query_qbd_regulatory_guidance(query=prompt, guideline="ICH Q8")

    assert result["status"] == "success"
    assert result["total_results"] > 0
    assert "top_citation" in result

    # Check top citation references ICH Q8(R2)
    top_cit = result["top_citation"]
    assert "ICH Q8" in top_cit
    assert "Normal Operating Range (NOR) vs. Proven Acceptable Range (PAR)" in top_cit

    top_chunk = result["results"][0]
    content = top_chunk["content"].lower()

    # Verify key regulatory definitions
    assert "normal operating range" in content or "nor" in content
    assert "proven acceptable range" in content or "par" in content
    assert "routinely" in content or "normal commercial manufacturing" in content
    assert "keeping other parameters constant" in content

    # Verify hierarchy and compliance distinctions
    assert "nor" in content and "par" in content and "design space" in content
    assert "compliance" in content or "regulatory change" in content


# =============================================================================
# Test 2: Multi-Guideline Retrieval (ICH Q9, Q10, Q14)
# =============================================================================

def test_ich_q9_fmea_rpn_retrieval():
    """Verify retrieval for ICH Q9(R1) FMEA RPN calculation and scoring."""
    prompt = "How is Risk Priority Number (RPN) calculated in FMEA according to ICH Q9?"
    result = query_qbd_regulatory_guidance(query=prompt, guideline="ICH Q9")

    assert result["status"] == "success"
    top_chunk = result["results"][0]
    assert "ICH Q9" in top_chunk["citation"]
    content = top_chunk["content"].lower()
    assert "rpn" in content or "risk priority number" in content
    assert "severity" in content
    assert "occurrence" in content or "probability" in content
    assert "detectability" in content


def test_ich_q14_atp_retrieval():
    """Verify retrieval for ICH Q14 Analytical Target Profile (ATP)."""
    prompt = "What is an Analytical Target Profile (ATP) in ICH Q14?"
    result = query_qbd_regulatory_guidance(query=prompt, guideline="ICH Q14")

    assert result["status"] == "success"
    top_chunk = result["results"][0]
    assert "ICH Q14" in top_chunk["citation"]
    content = top_chunk["content"].lower()
    assert "analytical target profile" in content or "atp" in content
    assert "qtpp" in content or "measurement" in content


def test_ich_q10_pqs_retrieval():
    """Verify retrieval for ICH Q10 Pharmaceutical Quality System elements."""
    prompt = "What are the four core PQS elements in ICH Q10?"
    result = query_qbd_regulatory_guidance(query=prompt, guideline="ICH Q10")

    assert result["status"] == "success"
    top_chunk = result["results"][0]
    assert "ICH Q10" in top_chunk["citation"]
    content = top_chunk["content"].lower()
    assert "capa" in content or "change management" in content or "monitoring system" in content


# =============================================================================
# Test 3: Tool Execution Dispatcher
# =============================================================================

def test_execute_tool_regulatory_guidance():
    """Verify execute_tool dispatches query_qbd_regulatory_guidance properly."""
    args = {
        "query": "What is the difference between Normal Operating Range (NOR) and Proven Acceptable Range (PAR) according to ICH Q8?",
        "guideline": "ICH Q8"
    }
    tool_output = execute_tool("query_qbd_regulatory_guidance", args)

    assert tool_output["status"] == "success"
    assert "top_citation" in tool_output
    assert "ICH Q8" in tool_output["top_citation"]
    assert len(tool_output["results"]) >= 1


# =============================================================================
# Test 4: Agent Tool-Calling Orchestrator on Regulatory Inquiries
# =============================================================================

def test_agent_orchestrator_regulatory_rag():
    """
    Tests that the Groq agent orchestrator:
    1. Selects query_qbd_regulatory_guidance for the target prompt.
    2. Executes the deterministic RAG tool.
    3. Synthesizes a response with accurate ICH Q8(R2) citation, definitions of NOR and PAR,
       and operational/compliance differences.
    """
    user_prompt = "What is the difference between Normal Operating Range (NOR) and Proven Acceptable Range (PAR) according to ICH Q8?"

    # Mock Groq client simulating tool calling
    mock_client = MagicMock()

    # Step 1: Model decides to call query_qbd_regulatory_guidance
    mock_tool_call = MagicMock()
    mock_tool_call.id = "call_qbd_rag_001"
    mock_tool_call.type = "function"
    mock_tool_call.function.name = "query_qbd_regulatory_guidance"
    mock_tool_call.function.arguments = json.dumps({
        "query": user_prompt,
        "guideline": "ICH Q8"
    })

    first_message = MagicMock()
    first_message.tool_calls = [mock_tool_call]
    first_message.content = None

    first_choice = MagicMock()
    first_choice.message = first_message

    first_response = MagicMock()
    first_response.choices = [first_choice]

    # Step 2: Model synthesizes final response incorporating tool results
    expected_synthesis = (
        "### Regulatory Comparison: Normal Operating Range (NOR) vs. Proven Acceptable Range (PAR)\n\n"
        "**Citation:** According to **ICH Q8(R2) Pharmaceutical Development (Section 6 & Glossary)**:\n\n"
        "1. **Normal Operating Range (NOR)**:\n"
        "   - **Definition:** The range within which a process parameter is routinely controlled and operated during normal commercial manufacturing.\n"
        "   - **Purpose:** Accounts for routine operational fluctuations, equipment tolerances, and operator control around the nominal setpoint.\n"
        "   - **Compliance:** Routine operation within the NOR represents standard state of control.\n\n"
        "2. **Proven Acceptable Range (PAR)**:\n"
        "   - **Definition:** A characterized range of a process parameter for which operation within this range, while keeping other parameters constant, will result in producing a product meeting the relevant quality criteria (ICH Q8(R2) Glossary).\n"
        "   - **Nature:** Typically univariate (evaluated one factor at a time holding others fixed).\n\n"
        "3. **Key Differences & Hierarchy**:\n"
        "   - **Hierarchy:** $\\text{NOR} \\subseteq \\text{PAR} \\subseteq \\text{Design Space}$.\n"
        "   - **Excursions:** Operating outside the NOR but within the PAR does NOT constitute a regulatory change because quality is assured, though it may be documented under internal QMS change management. In contrast, operating outside the PAR/Design Space constitutes a regulatory departure requiring formal investigation or post-approval variation."
    )

    second_message = MagicMock()
    second_message.tool_calls = None
    second_message.content = expected_synthesis

    second_choice = MagicMock()
    second_choice.message = second_message

    second_response = MagicMock()
    second_response.choices = [second_choice]

    # Configure mock client completions sequence
    mock_client.chat.completions.create.side_effect = [first_response, second_response]

    agent = DoEAgent(client=mock_client)
    final_output = agent.run(user_prompt)

    # Asserts
    assert len(agent.tool_calls_history) == 1
    executed_call = agent.tool_calls_history[0]
    assert executed_call["name"] == "query_qbd_regulatory_guidance"
    assert "ICH Q8" in executed_call["output"]["top_citation"]

    # Verify synthesized output quality
    assert "ICH Q8(R2)" in final_output
    assert "Normal Operating Range (NOR)" in final_output
    assert "Proven Acceptable Range (PAR)" in final_output
    assert "Design Space" in final_output
    assert "univariate" in final_output or "keeping other parameters constant" in final_output


# =============================================================================
# Test 5: Regulatory RAG Fallback - "Not Found in Knowledge Base" (Rule 3)
# =============================================================================

def test_regulatory_rag_not_found_fallback(monkeypatch):
    """Verify that off-topic queries return 'not found in knowledge base'."""
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    unrelated_query = "What is the orbital velocity of the International Space Station in low Earth orbit?"
    result = query_qbd_regulatory_guidance(query=unrelated_query)

    assert result["status"] == "not_found"
    assert result["total_results"] == 0
    assert result["results"] == []
    assert result["message"] == "not found in knowledge base"
    assert result["top_citation"] == "not found in knowledge base"

    # Also test via Chat API endpoint
    req = ChatRequest(message="What is the orbital speed of Mars according to ICH Q8?")
    chat_res = handle_chat_execution(req)
    assert chat_res["status"] == "not_found"
    assert "not found in knowledge base" in chat_res["response_text"].lower()
    assert chat_res["charts"] == []


# =============================================================================
# Test 6: Regulatory Claims Strict Citation Format (Rule 3)
# =============================================================================

def test_regulatory_citations_strict_format():
    """Verify that successful regulatory retrieval provides formal document + section citations."""
    query = "What is the definition of Design Space according to ICH Q8?"
    result = query_qbd_regulatory_guidance(query=query, guideline="ICH Q8")

    assert result["status"] == "success"
    assert result["total_results"] > 0
    top_citation = result["top_citation"]
    assert "ICH Q8" in top_citation
    assert "Section" in top_citation or "Design Space" in top_citation

    # Verify results contain citation metadata
    for item in result["results"]:
        assert "citation" in item
        assert "ICH Q8" in item["citation"]


# =============================================================================
# Runner
# =============================================================================

if __name__ == "__main__":
    print("Running QbD Knowledge Base & Regulatory RAG tests...")
    test_nor_vs_par_ich_q8_retrieval()
    print("[PASS] Test 1: Direct NOR vs. PAR retrieval & citation passed.")
    test_ich_q9_fmea_rpn_retrieval()
    print("[PASS] Test 2a: ICH Q9(R1) FMEA RPN retrieval passed.")
    test_ich_q14_atp_retrieval()
    print("[PASS] Test 2b: ICH Q14 ATP retrieval passed.")
    test_ich_q10_pqs_retrieval()
    print("[PASS] Test 2c: ICH Q10 PQS elements retrieval passed.")
    test_execute_tool_regulatory_guidance()
    print("[PASS] Test 3: Tool dispatcher execution passed.")
    test_agent_orchestrator_regulatory_rag()
    print("[PASS] Test 4: Agent orchestrator regulatory RAG loop passed.")
    print("\nAll QbD Regulatory RAG tests PASSED successfully!")
