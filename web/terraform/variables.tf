variable "project_id" {
  description = "GCP project id that hosts the zakuzaku-web service."
  type        = string
  default     = "blackathon"
}

variable "region" {
  description = "Region for Cloud Run, Artifact Registry and the WIF pool."
  type        = string
  default     = "asia-northeast1"
}

variable "firestore_location" {
  description = "Firestore database location id (multi-region or region). Immutable once the database exists."
  type        = string
  default     = "asia-northeast1"
}

variable "service_name" {
  description = "Cloud Run service name."
  type        = string
  default     = "zakuzaku-web"
}

variable "artifact_repo_id" {
  description = "Artifact Registry Docker repository id."
  type        = string
  default     = "web"
}

variable "image_name" {
  description = "Image name (path) pushed into the Artifact Registry repo by CI."
  type        = string
  default     = "zakuzaku-web"
}

variable "container_image" {
  description = <<-EOT
    Fully-qualified container image deployed to Cloud Run. Defaults to a public
    placeholder so the first `terraform apply` can create the service before any
    real image exists. CI replaces it on every deploy, and Cloud Run ignores
    changes to this field via lifecycle.ignore_changes so Terraform never reverts
    the running revision back to the placeholder.
  EOT
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "github_owner" {
  description = "GitHub org/owner that owns the deploy repository (used for WIF binding)."
  type        = string
  default     = "a-company-jp"
}

variable "github_repo" {
  description = "GitHub repository name that is allowed to deploy via WIF."
  type        = string
  default     = "oh-my-blackthunder"
}

variable "min_instances" {
  description = "Cloud Run minimum instance count (0 = scale to zero)."
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Cloud Run maximum instance count."
  type        = number
  default     = 3
}

variable "cpu" {
  description = "CPU limit per Cloud Run instance."
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory limit per Cloud Run instance."
  type        = string
  default     = "512Mi"
}

variable "concurrency" {
  description = "Maximum concurrent requests handled by a single Cloud Run instance."
  type        = number
  default     = 80
}

variable "next_public_firebase" {
  description = <<-EOT
    NEXT_PUBLIC_* Firebase web config. These are baked into the client bundle at
    BUILD time by CI (build args), NOT injected here — this map only documents the
    expected keys and lets CI read them out of Terraform if desired. Cloud Run
    runtime env never needs them. Keys mirror web/.env.example, e.g.
    NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, etc.
  EOT
  type        = map(string)
  default     = {}
}

variable "github_oauth_client_id" {
  description = "PUBLIC GitHub OAuth App client id, exposed to the server as GITHUB_OAUTH_CLIENT_ID."
  type        = string
  default     = ""
}
