resource "google_artifact_registry_repository" "web" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repo_id
  description   = "Docker images for the zakuzaku-web Cloud Run service."
  format        = "DOCKER"

  # Keep image storage bounded: delete untagged images after 7 days and retain
  # only the most recent tagged releases.
  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"
    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s" # 7 days
    }
  }

  cleanup_policies {
    id     = "keep-recent-tagged"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  depends_on = [google_project_service.services]
}
