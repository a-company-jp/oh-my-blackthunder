output "workload_identity_provider" {
  description = "Full WIF provider resource name. Set as the WIF_PROVIDER GitHub Actions variable for google-github-actions/auth."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_sa_email" {
  description = "Deployer service account email. Set as the DEPLOYER_SA GitHub Actions variable (service_account for google-github-actions/auth)."
  value       = google_service_account.deployer.email
}

output "runtime_sa_email" {
  description = "Runtime service account email attached to the Cloud Run service."
  value       = google_service_account.runtime.email
}

output "artifact_registry_repo" {
  description = "Artifact Registry Docker repo path (region-docker.pkg.dev/project/repo) for tagging/pushing images."
  value       = "${google_artifact_registry_repository.web.location}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.web.repository_id}"
}

output "cloud_run_url" {
  description = "Public URL of the deployed Cloud Run service."
  value       = google_cloud_run_v2_service.web.uri
}
