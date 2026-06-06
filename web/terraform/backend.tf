terraform {
  # Remote state in a GCS bucket. The bucket is bootstrapped OUT-OF-BAND (it must
  # exist before `terraform init`) because Terraform cannot create the bucket that
  # stores its own state. See README.md for the one-time bootstrap command:
  #
  #   gcloud storage buckets create gs://blackathon-tf-state-web \
  #     --project=blackathon --location=asia-northeast1 \
  #     --uniform-bucket-level-access
  #
  # The bucket name is supplied via partial config at init time so it is never
  # hard-coded here:
  #
  #   terraform init -backend-config=bucket=blackathon-tf-state-web
  backend "gcs" {
    prefix = "web/prod"
  }
}
