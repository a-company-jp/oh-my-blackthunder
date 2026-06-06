resource "google_cloud_run_v2_service" "web" {
  project  = var.project_id
  name     = var.service_name
  location = var.region

  # Publicly reachable leaderboard.
  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    max_instance_request_concurrency = var.concurrency

    containers {
      image = var.container_image

      ports {
        container_port = 8080
      }

      env {
        name  = "GITHUB_OAUTH_CLIENT_ID"
        value = var.github_oauth_client_id
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      # Server-only secret, mounted as a secret-env from Secret Manager (latest).
      env {
        name = "GITHUB_OAUTH_CLIENT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.github_oauth_client_secret.secret_id
            version = "latest"
          }
        }
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }
    }
  }

  # CI owns the deployed image and env at runtime: never let Terraform revert the
  # live revision back to the placeholder image or stale env on the next apply.
  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      template[0].containers[0].env,
    ]
  }

  depends_on = [
    google_project_service.services,
    google_secret_manager_secret_iam_member.runtime_access,
    google_project_iam_member.runtime_datastore_user,
  ]
}

# Public, unauthenticated access to the leaderboard.
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  project  = var.project_id
  location = google_cloud_run_v2_service.web.location
  name     = google_cloud_run_v2_service.web.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
