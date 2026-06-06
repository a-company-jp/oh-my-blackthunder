resource "google_secret_manager_secret" "github_oauth_client_secret" {
  project   = var.project_id
  secret_id = "GITHUB_OAUTH_CLIENT_SECRET"

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

# NOTE: no google_secret_manager_secret_version here on purpose — the secret VALUE
# is added OUT-OF-BAND so it never lands in Terraform state or VCS:
#   printf '%s' "<client-secret>" | \
#     gcloud secrets versions add GITHUB_OAUTH_CLIENT_SECRET --data-file=-

# Allow the Cloud Run runtime SA to read the secret (mounted as a secret-env).
resource "google_secret_manager_secret_iam_member" "runtime_access" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.github_oauth_client_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}
