"""
Comprehensive test suite for Coach Platform API
Run: pytest tests/test_api.py -v
"""
import pytest
import httpx
import os
import json
import asyncio

BASE = os.getenv("API_URL", "https://coach-api-1770519048.azurewebsites.net/api/v1")

# ============================================================================
# FIXTURES
# ============================================================================
@pytest.fixture(scope="session")
def base_url():
    return BASE

@pytest.fixture(scope="session")
def coach():
    """Register a test coach and return their data."""
    import random, string
    suffix = ''.join(random.choices(string.ascii_lowercase, k=6))
    data = {
        "full_name": f"Test Coach {suffix}",
        "email": f"testcoach_{suffix}@test.com",
        "phone": f"+91{''.join(random.choices(string.digits, k=10))}",
        "password": "testpass123",
        "specialization": "fitness",
        "bio": "Test coach for automated testing",
        "experience_years": 5
    }
    r = httpx.post(f"{BASE}/coaches/register", json=data, timeout=30)
    assert r.status_code == 200, f"Coach registration failed: {r.text}"
    result = r.json()
    assert result["success"] is True
    return {**result["coach"], "password": data["password"], "email": data["email"]}

@pytest.fixture(scope="session")
def coach_headers(coach):
    return {"X-Coach-Id": coach["id"], "Content-Type": "application/json"}

@pytest.fixture(scope="session")
def auth_token(coach):
    """Login and get coach data."""
    r = httpx.post(f"{BASE}/auth/login", json={"email": coach["email"], "password": coach["password"]}, timeout=30)
    assert r.status_code == 200
    result = r.json()
    assert result["success"] is True
    assert result["user"]["id"] == coach["id"]
    return result["user"]

# ============================================================================
# AUTH TESTS
# ============================================================================
class TestAuth:
    def test_register_coach(self, base_url):
        import random, string
        s = ''.join(random.choices(string.ascii_lowercase, k=6))
        r = httpx.post(f"{base_url}/coaches/register", json={
            "full_name": f"Reg Test {s}", "email": f"reg_{s}@test.com",
            "phone": f"+91{''.join(random.choices(string.digits, k=10))}",
            "password": "pass123", "specialization": "yoga"
        }, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert "id" in d["coach"]

    def test_register_duplicate_email(self, base_url, coach):
        r = httpx.post(f"{base_url}/coaches/register", json={
            "full_name": "Dup", "email": coach["email"],
            "phone": "+919999999999", "password": "pass"
        }, timeout=30)
        assert r.status_code == 400

    def test_login_success(self, base_url, coach):
        r = httpx.post(f"{base_url}/auth/login", json={
            "email": coach["email"], "password": coach["password"]
        }, timeout=30)
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_login_wrong_password(self, base_url, coach):
        r = httpx.post(f"{base_url}/auth/login", json={
            "email": coach["email"], "password": "wrongpass"
        }, timeout=30)
        assert r.status_code == 401

    def test_login_nonexistent_email(self, base_url):
        r = httpx.post(f"{base_url}/auth/login", json={
            "email": "nobody@test.com", "password": "pass"
        }, timeout=30)
        assert r.status_code == 401


# ============================================================================
# CLIENT TESTS
# ============================================================================
class TestClients:
    def test_create_client(self, base_url, coach_headers):
        r = httpx.post(f"{base_url}/clients", json={
            "name": "Test Client A", "phone": "+919800000001", "email": "clienta@test.com"
        }, headers=coach_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert d["client"]["name"] == "Test Client A"

    def test_create_client_minimal(self, base_url, coach_headers):
        r = httpx.post(f"{base_url}/clients", json={
            "name": "Minimal Client"
        }, headers=coach_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_get_clients(self, base_url, coach_headers):
        r = httpx.get(f"{base_url}/clients", headers=coach_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert isinstance(d["clients"], list)
        assert len(d["clients"]) >= 1

    def test_client_isolation(self, base_url):
        """Clients from one coach should not appear for another coach."""
        import random, string
        s = ''.join(random.choices(string.ascii_lowercase, k=6))
        # Register a new coach
        reg = httpx.post(f"{base_url}/coaches/register", json={
            "full_name": f"Iso Coach {s}", "email": f"iso_{s}@test.com",
            "phone": f"+91{''.join(random.choices(string.digits, k=10))}",
            "password": "pass123"
        }, timeout=30)
        new_coach_id = reg.json()["coach"]["id"]
        # This coach should have 0 clients
        r = httpx.get(f"{base_url}/clients",
                       headers={"X-Coach-Id": new_coach_id, "Content-Type": "application/json"}, timeout=30)
        assert len(r.json()["clients"]) == 0

    def test_bulk_import(self, base_url, coach_headers):
        r = httpx.post(f"{base_url}/clients/bulk-import", json={
            "clients": [
                {"name": "Bulk A", "phone": "+919100000001"},
                {"name": "Bulk B", "phone": "+919100000002"},
                {"name": "Bulk C", "email": "bulkc@test.com"},
            ]
        }, headers=coach_headers, timeout=30)
        assert r.status_code == 200
        assert "Imported" in r.json().get("message", "")

    def test_delete_client(self, base_url, coach_headers):
        # Create then delete
        cr = httpx.post(f"{base_url}/clients", json={"name": "ToDelete"},
                        headers=coach_headers, timeout=30)
        cid = cr.json()["client"]["id"]
        r = httpx.delete(f"{base_url}/clients/{cid}", headers=coach_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["success"] is True


# ============================================================================
# WORKOUT TESTS
# ============================================================================
class TestWorkouts:
    def test_create_workout(self, base_url, coach_headers):
        r = httpx.post(f"{base_url}/workouts/library", json={
            "name": "Test Workout A", "category": "strength", "duration_minutes": 45,
            "description": "Test workout"
        }, headers=coach_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert d["workout"]["name"] == "Test Workout A"

    def test_get_workouts(self, base_url, coach_headers):
        r = httpx.get(f"{base_url}/workouts/library", headers=coach_headers, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json()["workouts"], list)

    def test_workout_isolation(self, base_url):
        """Workouts from one coach should not appear for another."""
        import random, string
        s = ''.join(random.choices(string.ascii_lowercase, k=6))
        reg = httpx.post(f"{base_url}/coaches/register", json={
            "full_name": f"WkIso {s}", "email": f"wkiso_{s}@test.com",
            "phone": f"+91{''.join(random.choices(string.digits, k=10))}",
            "password": "pass123"
        }, timeout=30)
        new_id = reg.json()["coach"]["id"]
        r = httpx.get(f"{base_url}/workouts/library",
                       headers={"X-Coach-Id": new_id, "Content-Type": "application/json"}, timeout=30)
        assert len(r.json()["workouts"]) == 0

    def test_delete_workout(self, base_url, coach_headers):
        cr = httpx.post(f"{base_url}/workouts/library", json={
            "name": "DeleteMe", "category": "cardio", "duration_minutes": 20
        }, headers=coach_headers, timeout=30)
        wid = cr.json()["workout"]["id"]
        r = httpx.delete(f"{base_url}/workouts/{wid}", headers=coach_headers, timeout=30)
        assert r.status_code == 200


# ============================================================================
# SESSION TESTS
# ============================================================================
class TestSessions:
    def test_create_session(self, base_url, coach_headers):
        # First get a client
        clients = httpx.get(f"{base_url}/clients", headers=coach_headers, timeout=30).json()["clients"]
        assert len(clients) > 0, "Need at least one client"
        client_id = clients[0]["id"]
        r = httpx.post(f"{base_url}/sessions", json={
            "client_id": client_id,
            "scheduled_at": "2026-03-01T10:00",
            "duration_minutes": 60
        }, headers=coach_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_create_recurring_sessions(self, base_url, coach_headers):
        clients = httpx.get(f"{base_url}/clients", headers=coach_headers, timeout=30).json()["clients"]
        r = httpx.post(f"{base_url}/sessions/create-recurring", json={
            "client_id": clients[0]["id"],
            "recurrence_type": "weekly",
            "start_date": "2026-03-01",
            "time": "09:00",
            "num_sessions": 4,
            "duration_minutes": 60
        }, headers=coach_headers, timeout=30)
        assert r.status_code == 200
        assert "Created" in r.json().get("message", "")

    def test_get_sessions(self, base_url, coach_headers):
        r = httpx.get(f"{base_url}/sessions", headers=coach_headers, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json()["sessions"], list)

    def test_mark_attendance(self, base_url, coach_headers):
        sessions = httpx.get(f"{base_url}/sessions", headers=coach_headers, timeout=30).json()["sessions"]
        if sessions:
            sid = sessions[0]["id"]
            r = httpx.post(f"{base_url}/sessions/{sid}/mark-attendance",
                           json={"status": "attended"}, headers=coach_headers, timeout=30)
            assert r.status_code == 200

    def test_delete_session(self, base_url, coach_headers):
        sessions = httpx.get(f"{base_url}/sessions", headers=coach_headers, timeout=30).json()["sessions"]
        if sessions:
            r = httpx.delete(f"{base_url}/sessions/{sessions[-1]['id']}", headers=coach_headers, timeout=30)
            assert r.status_code == 200


# ============================================================================
# DASHBOARD TESTS
# ============================================================================
class TestDashboard:
    def test_stats(self, base_url, coach_headers):
        r = httpx.get(f"{base_url}/dashboard/stats", headers=coach_headers, timeout=30)
        assert r.status_code == 200
        s = r.json()["stats"]
        assert "total_clients" in s
        assert "total_sessions" in s

    def test_today_schedule(self, base_url, coach_headers):
        r = httpx.get(f"{base_url}/schedule/today", headers=coach_headers, timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json()["sessions"], list)


# ============================================================================
# COACH PROFILE & REVIEWS TESTS
# ============================================================================
class TestCoachProfile:
    def test_get_coaches(self, base_url):
        r = httpx.get(f"{base_url}/coaches", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json()["coaches"], list)

    def test_coach_profile(self, base_url, coach):
        r = httpx.get(f"{base_url}/coaches/{coach['id']}/profile", timeout=30)
        assert r.status_code == 200
        p = r.json()["profile"]
        assert p["name"] == coach["full_name"]
        assert "avg_rating" in p
        assert "reviews" in p

    def test_add_review(self, base_url, coach):
        r = httpx.post(f"{base_url}/coaches/{coach['id']}/reviews", json={
            "client_name": "Happy Client",
            "client_email": "happy@test.com",
            "rating": 5,
            "review_text": "Amazing coach! Highly recommended."
        }, timeout=30)
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_get_reviews(self, base_url, coach):
        r = httpx.get(f"{base_url}/coaches/{coach['id']}/reviews", timeout=30)
        assert r.status_code == 200
        assert len(r.json()["reviews"]) >= 1

    def test_profile_nonexistent(self, base_url):
        r = httpx.get(f"{base_url}/coaches/00000000-0000-0000-0000-000000000099/profile", timeout=30)
        assert r.status_code == 404


# ============================================================================
# REMINDERS & PAYMENTS TESTS
# ============================================================================
class TestRemindersPayments:
    def test_send_whatsapp_reminder(self, base_url, coach_headers):
        clients = httpx.get(f"{base_url}/clients", headers=coach_headers, timeout=30).json()["clients"]
        phone_clients = [c for c in clients if c.get("phone")]
        if phone_clients:
            r = httpx.post(f"{base_url}/reminders/send-personal", json={
                "client_id": phone_clients[0]["id"], "method": "whatsapp"
            }, headers=coach_headers, timeout=30)
            assert r.status_code == 200

    def test_create_payment_link(self, base_url, coach_headers):
        clients = httpx.get(f"{base_url}/clients", headers=coach_headers, timeout=30).json()["clients"]
        if clients:
            r = httpx.post(f"{base_url}/payments/create-razorpay-link", json={
                "client_id": clients[0]["id"], "amount": 2000
            }, headers=coach_headers, timeout=30)
            assert r.status_code == 200
            assert r.json()["success"] is True
            assert "payment_link" in r.json()


# ============================================================================
# ROOT & HEALTH
# ============================================================================
class TestHealth:
    def test_root(self, base_url):
        r = httpx.get(f"{base_url}/", timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ============================================================================
# LEADS / INTEREST REQUESTS TESTS
# ============================================================================
class TestLeads:
    def test_submit_interest(self, base_url, coach):
        r = httpx.post(f"{base_url}/coaches/{coach['id']}/interest", json={
            "lead_type": "interest",
            "name": "Interested Person",
            "email": "interested@test.com",
            "phone": "+919800001111",
            "message": "I want to get fit!"
        }, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert "lead" in d
        assert d["lead"]["name"] == "Interested Person"
        assert d["lead"]["status"] == "new"

    def test_submit_callback(self, base_url, coach):
        r = httpx.post(f"{base_url}/coaches/{coach['id']}/interest", json={
            "lead_type": "callback",
            "name": "Callback Person",
            "phone": "+919800002222",
            "message": "Please call me between 5-7pm"
        }, timeout=30)
        assert r.status_code == 200
        assert r.json()["lead"]["lead_type"] == "callback"

    def test_submit_referral(self, base_url, coach):
        r = httpx.post(f"{base_url}/coaches/{coach['id']}/interest", json={
            "lead_type": "referral",
            "name": "Referred Client",
            "email": "referred@test.com",
            "phone": "+919800003333",
            "message": "My friend recommended you",
            "referred_by_name": "Existing Client",
            "referred_by_email": "existing@test.com"
        }, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True

    def test_submit_interest_no_name(self, base_url, coach):
        r = httpx.post(f"{base_url}/coaches/{coach['id']}/interest", json={
            "lead_type": "interest",
            "name": "",
            "phone": "+919800001111"
        }, timeout=30)
        assert r.status_code == 400

    def test_submit_interest_no_contact(self, base_url, coach):
        r = httpx.post(f"{base_url}/coaches/{coach['id']}/interest", json={
            "lead_type": "interest",
            "name": "No Contact"
        }, timeout=30)
        assert r.status_code == 400

    def test_submit_interest_invalid_coach(self, base_url):
        r = httpx.post(f"{base_url}/coaches/00000000-0000-0000-0000-000000000099/interest", json={
            "lead_type": "interest",
            "name": "Test",
            "phone": "+919800000000"
        }, timeout=30)
        assert r.status_code == 404

    def test_get_leads(self, base_url, coach_headers):
        r = httpx.get(f"{base_url}/leads", headers=coach_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert isinstance(d["leads"], list)
        assert len(d["leads"]) >= 1

    def test_get_leads_filtered(self, base_url, coach_headers):
        r = httpx.get(f"{base_url}/leads?status=new", headers=coach_headers, timeout=30)
        assert r.status_code == 200
        for lead in r.json()["leads"]:
            assert lead["status"] == "new"

    def test_update_lead_status(self, base_url, coach_headers):
        leads = httpx.get(f"{base_url}/leads", headers=coach_headers, timeout=30).json()["leads"]
        new_leads = [l for l in leads if l["status"] == "new"]
        if new_leads:
            r = httpx.patch(f"{base_url}/leads/{new_leads[0]['id']}",
                            json={"status": "contacted", "coach_notes": "Called, will follow up"},
                            headers=coach_headers, timeout=30)
            assert r.status_code == 200

    def test_convert_lead_to_client(self, base_url, coach_headers, coach):
        # Create a fresh lead to convert
        lead_r = httpx.post(f"{base_url}/coaches/{coach['id']}/interest", json={
            "lead_type": "interest",
            "name": "Convert Me",
            "phone": "+919800009999",
            "email": "convertme@test.com"
        }, timeout=30)
        lead_id = lead_r.json()["lead"]["id"]
        r = httpx.post(f"{base_url}/leads/{lead_id}/convert",
                       headers=coach_headers, timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is True
        assert d["client"]["name"] == "Convert Me"

    def test_convert_nonexistent_lead(self, base_url, coach_headers):
        r = httpx.post(f"{base_url}/leads/00000000-0000-0000-0000-000000000099/convert",
                       headers=coach_headers, timeout=30)
        assert r.status_code == 404

    def test_leads_isolation(self, base_url):
        """Leads from one coach should not appear for another."""
        import random, string
        s = ''.join(random.choices(string.ascii_lowercase, k=6))
        reg = httpx.post(f"{base_url}/coaches/register", json={
            "full_name": f"LeadIso {s}", "email": f"leadiso_{s}@test.com",
            "phone": f"+91{''.join(random.choices(string.digits, k=10))}",
            "password": "pass123"
        }, timeout=30)
        new_id = reg.json()["coach"]["id"]
        r = httpx.get(f"{base_url}/leads",
                       headers={"X-Coach-Id": new_id, "Content-Type": "application/json"}, timeout=30)
        assert len(r.json()["leads"]) == 0
