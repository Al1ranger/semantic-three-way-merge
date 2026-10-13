import ast
import hashlib
import itertools
import json
from pathlib import Path
import pytest

SOURCE = Path("contracts/SemanticThreeWayMerge.py").read_text()
tree = ast.parse(SOURCE)
helpers = ast.Module(body=[n for n in tree.body if isinstance(n, ast.FunctionDef) and
    n.name not in ("clock", "no_value")], type_ignores=[])
ns = {"hashlib": hashlib, "json": json, "re": __import__("re"),
      "PAIRS": ((0, 1), (0, 2), (1, 2)), "LABELS": ("SAME", "DIFFERENT", "UNKNOWN")}
exec(compile(helpers, "<actual-contract-helpers>", "exec"), ns)
merge, compare, parse = ns["merge_documents"], ns["comparisons"], ns["parse_document"]


@pytest.mark.parametrize("values,labels,state,choice,reason", [
    (["base text", "base text", "base text"], [], "MERGED", 0, "UNCHANGED"),
    (["base text", "left text", "base text"], ["DIFFERENT", "DIFFERENT"], "MERGED", 1, "LEFT_EDIT"),
    (["base text", "base text", "right text"], ["DIFFERENT", "DIFFERENT"], "MERGED", 2, "RIGHT_EDIT"),
    (["base text", "left text", "right text"], ["SAME", "DIFFERENT", "DIFFERENT"], "MERGED", 2, "RIGHT_EDIT"),
    (["base text", "left text", "right text"], ["DIFFERENT", "SAME", "DIFFERENT"], "MERGED", 1, "LEFT_EDIT"),
    (["base text", "left text", "right text"], ["DIFFERENT", "DIFFERENT", "SAME"], "MERGED", 1, "CONVERGENT_EDIT"),
    (["base text", "left text", "right text"], ["DIFFERENT"] * 3, "CONFLICTED", -1, "EDIT_EDIT"),
    (["base text", None, "right text"], ["DIFFERENT"], "CONFLICTED", -1, "DELETE_EDIT"),
    (["base text", None, "right text"], ["SAME"], "MERGED", 1, "LEFT_EDIT"),
    ([None, "left text", "right text"], ["DIFFERENT"], "CONFLICTED", -1, "ADD_ADD"),
    ([None, "left text", "right text"], ["SAME"], "MERGED", 1, "CONVERGENT_EDIT"),
    (["base text", None, None], [], "MERGED", 1, "CONVERGENT_EDIT"),
    (["base text", "left text", "right text"], ["SAME", "SAME", "DIFFERENT"], "CONFLICTED", -1, "INCONSISTENT_EQUIVALENCE"),
    (["base text", "left text", "right text"], ["UNKNOWN"] * 3, "INCONCLUSIVE", -1, "UNKNOWN_MEANING"),
])
def test_algebra(values, labels, state, choice, reason):
    docs = [{} if v is None else {"field": v} for v in values]
    actual = merge(docs, labels)
    assert actual["state"] == state
    assert actual["rows"][0]["choice"] == choice
    assert actual["rows"][0]["reason"] == reason
    if state != "MERGED":
        assert actual["merged"] == []


def test_exhaustive_presence_and_labels():
    count = 0
    for values in itertools.product([None, "alpha text", "beta text", "gamma text"], repeat=3):
        docs = [{} if v is None else {"x": v} for v in values]
        _, tasks, _ = compare(docs)
        for labels in itertools.product(ns["LABELS"], repeat=len(tasks)):
            actual = merge(docs, list(labels))
            count += 1
            if actual["state"] != "MERGED":
                assert actual["merged"] == []
            for row in actual["merged"]:
                assert row["text"] == docs[row["slot"]][row["id"]]
            # Swap branches: merged meaning must survive, though equivalent text preference may differ.
            swapped = [docs[0], docs[2], docs[1]]
            old = actual["rows"][0]["vector"] if actual["rows"] else []
            newlabels = []
            for task in compare(swapped)[1]:
                oldpair = {(0,1): 1, (0,2): 0, (1,2): 2}[tuple(task["slots"])]
                newlabels.append(old[oldpair])
            assert merge(swapped, newlabels)["state"] == actual["state"]
    assert count == 400


@pytest.mark.parametrize("raw", [
    '{"records":[{"id":"a","text":"valid text"},{"id":"a","text":"valid text"}]}',
    '{"records":[],"records":[]}',
    '{"records":[{"id":"a","text":" x "}]}',
    '{"records":[{"id":"a","text":"valid text","summary":"fake"}]}',
    '{"records":[{"id":"../a","text":"valid text"}]}',
    '{"records":null}',
])
def test_invalid_schema(raw):
    assert parse(raw) is None


def test_union_sorted_and_deleted_provenance():
    docs = [{"z": "old value", "a": "stable text"}, {"a": "stable text"}, {"z": "old value", "a": "stable text"}]
    result = merge(docs, [])
    assert result["merged"] == [{"id": "a", "text": "stable text", "slot": 0}]


def test_inconsistency_never_publishes_other_safe_rows():
    docs = [{"x": "base text", "a": "stable text"}, {"x": "left text", "a": "stable text"},
            {"x": "right text", "a": "stable text"}]
    assert merge(docs, ["SAME", "SAME", "DIFFERENT"])["merged"] == []


def test_equivalence_checks_all_decision_fields():
    report = {"state": "MERGED", "rows": [{"choice": 2}], "sources": [{"hash": "a"}]}
    for field, value in [("state", "CONFLICTED"), ("rows", [{"choice": 1}]), ("sources", [{"hash": "b"}])]:
        other = dict(report, **{field: value})
        assert not ns["equivalent"](report, other)
    assert ns["equivalent"](report, json.loads(json.dumps(report)))
    assert not ns["equivalent"](None, report)


def test_actual_validator_callback_refetches_and_checks_full_report():
    from types import SimpleNamespace
    klass = next(n for n in tree.body if isinstance(n, ast.ClassDef))
    method = next(n for n in klass.body if isinstance(n, ast.FunctionDef) and n.name == "reconcile")
    validator = next(n for n in method.body if isinstance(n, ast.FunctionDef) and n.name == "validate")
    class Return:
        def __init__(self, data):
            self.calldata = data
    calls = []
    report = {"state": "MERGED", "sources": [{"hash": "real"}], "rows": [{"choice": 2}]}
    def independent():
        calls.append(True)
        return report
    local = {"gl": SimpleNamespace(vm=SimpleNamespace(Return=Return)),
             "equivalent": ns["equivalent"], "observe": independent}
    exec(compile(ast.Module(body=[validator], type_ignores=[]), "<actual-validator>", "exec"), local)
    assert local["validate"](Return(report))
    assert not local["validate"](Return(dict(report, sources=[{"hash": "forged"}])))
    assert not local["validate"](Return(dict(report, rows=[{"choice": 1}])))
    assert len(calls) == 3
    assert not local["validate"](object())
    assert len(calls) == 3


@pytest.fixture
def contract(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    direct_vm.warp("2026-10-12T12:00:00Z")
    return direct_deploy("contracts/SemanticThreeWayMerge.py")


def addr(value):
    return "0x" + value.hex() if isinstance(value, bytes) else str(value)


def prepare(contract, vm, alice, labels=None, middle="left", bad=False, job_id="demo"):
    files = ["base", middle, "right"]
    raw = [Path(f"examples/fixtures/{name}.json").read_bytes() for name in files]
    hashes = [hashlib.sha256(x).hexdigest() for x in raw]
    if bad:
        hashes[1] = "0" * 64
    for name, body in zip(files, raw):
        vm.mock_web(r".*/" + name + r"\.json", {"status": 200, "body": body})
    if labels is not None:
        vm.mock_llm(r"(?s).*SEMANTIC DIFF3.*", json.dumps({"labels": labels}))
    contract.open_merge(job_id, "Al1ranger", "semantic-three-way-merge", "a" * 40,
                        ",".join(f"examples/fixtures/{f}.json" for f in files), ",".join(hashes), 1791810000)
    return contract.job_key(addr(alice), job_id)


def test_direct_semantic_merge(contract, direct_vm, direct_alice):
    key = prepare(contract, direct_vm, direct_alice, ["DIFFERENT", "DIFFERENT", "SAME", "DIFFERENT", "DIFFERENT"])
    contract.reconcile(key, 0)
    job = contract.get_job(key)
    assert job["state"] == "MERGED"
    artifact = contract.get_artifact(key)
    rows = {r["id"]: r for r in artifact["documents"]}
    assert rows["delivery"]["slot"] == 2
    assert rows["contact"]["slot"] == 1
    assert artifact["root"] == ns["digest"]({k:v for k,v in artifact.items() if k != "root"})
    assert contract.get_record(key, "delivery")["artifact_root"] == artifact["root"]


def test_direct_edit_conflict(contract, direct_vm, direct_alice):
    key = prepare(contract, direct_vm, direct_alice, ["DIFFERENT"] * 3, middle="conflict")
    contract.reconcile(key, 0)
    assert contract.get_job(key)["state"] == "CONFLICTED"
    with direct_vm.expect_revert("no merge artifact"):
        contract.get_artifact(key)


def test_direct_unknown(contract, direct_vm, direct_alice):
    key = prepare(contract, direct_vm, direct_alice, ["UNKNOWN"] * 3, middle="conflict")
    contract.reconcile(key, 0)
    assert contract.get_job(key)["state"] == "INCONCLUSIVE"


def test_direct_fake_hash(contract, direct_vm, direct_alice):
    key = prepare(contract, direct_vm, direct_alice, bad=True)
    contract.reconcile(key, 0)
    assert contract.get_job(key)["state"] == "INVALID"
    assert contract.get_job(key)["attempts"][0]["reason"] == "HASH_OR_SIZE"


def test_direct_replay(contract, direct_vm, direct_alice):
    key = prepare(contract, direct_vm, direct_alice, ["DIFFERENT"] * 3, middle="conflict")
    contract.reconcile(key, 0)
    with direct_vm.expect_revert("closed or stale"):
        contract.reconcile(key, 0)


def test_direct_duplicate(contract, direct_vm, direct_alice):
    prepare(contract, direct_vm, direct_alice)
    with direct_vm.expect_revert("duplicate"):
        prepare(contract, direct_vm, direct_alice)


def test_direct_expiry(contract, direct_vm, direct_alice):
    key = prepare(contract, direct_vm, direct_alice)
    direct_vm.warp("2026-10-13T12:00:00Z")
    from genlayer import gl
    gl.message_raw["datetime"] = "2026-10-13T12:00:00Z"
    with direct_vm.expect_revert("closed or stale"):
        contract.reconcile(key, 0)
    contract.expire(key)
    assert contract.get_job(key)["state"] == "EXPIRED"


def test_direct_wrong_namespace(contract, direct_vm, direct_alice, direct_bob):
    key = prepare(contract, direct_vm, direct_alice)
    other = contract.job_key(addr(direct_bob), "demo")
    assert key != other
    with direct_vm.expect_revert("unknown job"):
        contract.reconcile(other, 0)


def test_direct_wrong_attempt(contract, direct_vm, direct_alice):
    key = prepare(contract, direct_vm, direct_alice)
    with direct_vm.expect_revert("closed or stale"):
        contract.reconcile(key, 1)


def test_direct_model_schema_error_leaves_job_open(contract, direct_vm, direct_alice):
    key = prepare(contract, direct_vm, direct_alice, ["SAME"])
    with direct_vm.expect_revert("malformed semantic vector"):
        contract.reconcile(key, 0)
    assert contract.get_job(key)["state"] == "OPEN"
    assert contract.get_job(key)["attempts"] == []


def test_direct_http_failures_have_bounded_liveness(contract, direct_vm, direct_alice):
    direct_vm.mock_web(r".*/base\.json", {"status": 503, "body": b"unavailable"})
    key = prepare(contract, direct_vm, direct_alice)
    for attempt in range(3):
        contract.reconcile(key, attempt)
    assert contract.get_job(key)["state"] == "INCONCLUSIVE"
    assert len(contract.get_job(key)["attempts"]) == 3
    with direct_vm.expect_revert("closed or stale"):
        contract.reconcile(key, 3)


def test_direct_permissionless_processor(contract, direct_vm, direct_alice, direct_bob):
    key = prepare(contract, direct_vm, direct_alice, ["DIFFERENT"] * 3, middle="conflict")
    direct_vm.sender = direct_bob
    contract.reconcile(key, 0)
    report = contract.get_job(key)["attempts"][0]
    assert report["binding"]["observer"] == addr(direct_bob)
    assert report["binding"]["job"] == key


@pytest.mark.parametrize("paths", ["../base.json,left.json,right.json",
    "base.json,base.json,right.json", "base.json,left.json", "https://evil.test/a,b,c"])
def test_direct_invalid_paths(contract, direct_vm, paths):
    with direct_vm.expect_revert("invalid pinned sources"):
        contract.open_merge("bad-path", "Al1ranger", "demo", "a" * 40,
                            paths, ",".join(["b" * 64] * 3), 1791810000)
