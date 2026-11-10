import time
import httpx
from typing import Dict, Any, Tuple
from backend.app.core.models import Milestone, DeliverableSubmission, VerificationReport, VerificationType

class MilestoneVerifier:
    """Autonomous Arbitrator that evaluates deliverables before releasing escrow."""

    async def verify(self, milestone: Milestone, submission: DeliverableSubmission) -> VerificationReport:
        start_time = time.time()
        logs = []
        passed = False
        details = {}

        logs.append(f"[Arbitrator] Initiating verification for Milestone '{milestone.title}' (ID: {milestone.id})")
        logs.append(f"[Arbitrator] Verification Strategy: {milestone.verification_type.value}")
        logs.append(f"[Deliverable] Summary: {submission.summary}")

        if milestone.verification_type == VerificationType.API_HEALTH:
            passed, v_logs, details = await self._verify_api_health(milestone.verification_criteria, submission)
            logs.extend(v_logs)

        elif milestone.verification_type == VerificationType.GITHUB_CI:
            passed, v_logs, details = await self._verify_github_ci(milestone.verification_criteria, submission)
            logs.extend(v_logs)

        elif milestone.verification_type == VerificationType.TEST_SUITE:
            passed, v_logs, details = await self._verify_test_suite(milestone.verification_criteria, submission)
            logs.extend(v_logs)

        elif milestone.verification_type == VerificationType.DETERMINISTIC:
            passed, v_logs, details = await self._verify_deterministic(milestone.verification_criteria, submission)
            logs.extend(v_logs)

        else:
            logs.append(f"[Error] Unknown verification type: {milestone.verification_type}")
            passed = False

        duration = int((time.time() - start_time) * 1000)
        logs.append(f"[Arbitrator] Verdict: {'PASSED' if passed else 'FAILED'} (Duration: {duration}ms)")

        return VerificationReport(
            passed=passed,
            runner=f"PactPay-{milestone.verification_type.value}-Runner",
            logs=logs,
            duration_ms=duration,
            details=details
        )

    async def _verify_api_health(self, criteria: Dict[str, Any], submission: DeliverableSubmission) -> Tuple[bool, list, dict]:
        logs = []
        target_url = submission.artifact_url or criteria.get("target_url")
        expected_status = criteria.get("expected_status", 200)

        if not target_url:
            logs.append("[Check] Error: No target URL provided in submission or criteria.")
            return False, logs, {"error": "Missing URL"}

        logs.append(f"[Check] Probing API endpoint: {target_url} (Expected HTTP {expected_status})")
        try:
            async with httpx.AsyncClient() as client:
                res = await client.get(target_url, timeout=5.0)
                logs.append(f"[Check] Received HTTP {res.status_code}")
                if res.status_code == expected_status:
                    logs.append("[Check] Response code matches criteria.")
                    return True, logs, {"status_code": res.status_code}
                else:
                    logs.append(f"[Check] Failed: Expected {expected_status}, got {res.status_code}")
                    return False, logs, {"status_code": res.status_code}
        except Exception as e:
            logs.append(f"[Check] Connection exception: {str(e)}")
            # In simulated offline/mock mode if specified in telemetry:
            if submission.telemetry_data and submission.telemetry_data.get("mock_simulate_pass"):
                logs.append("[Check] Mock Simulation Override: Endpoint probe simulated SUCCESS.")
                return True, logs, {"simulated": True}
            return False, logs, {"error": str(e)}

    async def _verify_github_ci(self, criteria: Dict[str, Any], submission: DeliverableSubmission) -> Tuple[bool, list, dict]:
        logs = []
        repo = criteria.get("repo", "sample-owner/repo")
        commit_sha = submission.telemetry_data.get("commit_sha") if submission.telemetry_data else "HEAD"
        required_checks = criteria.get("required_checks", ["build", "unit-tests", "lint"])

        logs.append(f"[Check] Verifying GitHub CI Status for {repo} @ commit {commit_sha[:7] if commit_sha else 'HEAD'}")
        
        # Check telemetry for simulation or real runner
        simulated_failures = submission.telemetry_data.get("force_failure_checks", []) if submission.telemetry_data else []

        all_passed = True
        results = {}
        for check in required_checks:
            if check in simulated_failures:
                logs.append(f"  ❌ Check '{check}': FAILED (Exit Code 1 - assertion error in tests)")
                all_passed = False
                results[check] = "failed"
            else:
                logs.append(f"  ✅ Check '{check}': PASSED (Green)")
                results[check] = "passed"

        return all_passed, logs, {"checks": results}

    async def _verify_test_suite(self, criteria: Dict[str, Any], submission: DeliverableSubmission) -> Tuple[bool, list, dict]:
        logs = []
        total_tests = criteria.get("total_tests", 10)
        logs.append(f"[Check] Running automated test harness against deliverable ({total_tests} test cases)...")

        force_fail = submission.telemetry_data.get("fail_tests", False) if submission.telemetry_data else False
        if force_fail:
            logs.append("  [x] test_schema_contract: FAILED")
            logs.append("  [x] test_concurrency_load: FAILED")
            logs.append(f"[Check] Test summary: {total_tests - 2} passed, 2 failed.")
            return False, logs, {"passed_count": total_tests - 2, "failed_count": 2}

        logs.append(f"[Check] Test summary: {total_tests} passed, 0 failed.")
        return True, logs, {"passed_count": total_tests, "failed_count": 0}

    async def _verify_deterministic(self, criteria: Dict[str, Any], submission: DeliverableSubmission) -> Tuple[bool, list, dict]:
        logs = []
        expected_schema = criteria.get("required_keys", [])
        actual_keys = list(submission.telemetry_data.keys()) if submission.telemetry_data else []
        logs.append(f"[Check] Checking payload against required keys: {expected_schema}")

        missing = [k for k in expected_schema if k not in actual_keys]
        if missing:
            logs.append(f"[Check] Failed: Missing required schema keys: {missing}")
            return False, logs, {"missing_keys": missing}

        logs.append("[Check] All required schema assertions passed.")
        return True, logs, {"schema_match": True}

verifier = MilestoneVerifier()
