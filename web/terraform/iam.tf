# ---------------------------------------------------------------------------
# Runtime service account — attached to the Cloud Run service. firebase-admin
# uses this identity's Application Default Credentials to reach Firestore.
# ---------------------------------------------------------------------------
resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = "zakuzaku-run"
  display_name = "zakuzaku-web Cloud Run runtime"

  depends_on = [google_project_service.services]
}

resource "google_project_iam_member" "runtime_datastore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

# ---------------------------------------------------------------------------
# Deployer service account — impersonated by GitHub Actions via Workload
# Identity Federation to build/push images, deploy Cloud Run and ship rules.
# ---------------------------------------------------------------------------
resource "google_service_account" "deployer" {
  project      = var.project_id
  account_id   = "gh-deployer"
  display_name = "GitHub Actions deployer (zakuzaku-web)"

  depends_on = [google_project_service.services]
}

resource "google_project_iam_member" "deployer_artifactregistry_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_project_iam_member" "deployer_run_developer" {
  project = var.project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_project_iam_member" "deployer_firebaserules_admin" {
  project = var.project_id
  role    = "roles/firebaserules.admin"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

# The deployer must be able to act as (deploy a service running as) the runtime
# SA when it sets the Cloud Run service account on a new revision.
resource "google_service_account_iam_member" "deployer_act_as_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}

# firebase-tools runs an API-enablement precheck (serviceusage.services.get on
# firestore.googleapis.com) before `deploy --only firestore:rules`. Without this
# the rules job 403s ("Permission denied to get service"). serviceUsageConsumer
# grants the services.get/list that precheck needs.
resource "google_project_iam_member" "deployer_serviceusage_consumer" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageConsumer"
  member  = "serviceAccount:${google_service_account.deployer.email}"
}
