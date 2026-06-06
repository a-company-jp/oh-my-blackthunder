locals {
  # Service APIs that must be enabled before the rest of the stack can be created.
  services = [
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "firestore.googleapis.com",
    "firebaserules.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ]
}

resource "google_project_service" "services" {
  for_each = toset(local.services)

  project = var.project_id
  service = each.value

  # Keep APIs enabled even when this stack is destroyed — other resources in the
  # project (and a future re-apply) depend on them.
  disable_on_destroy = false
}
