# zakuzaku-web — Terraform (GCP)

Infrastructure-as-Code for the **AIザクザク度 & ブラックサンダーカウント** leaderboard
running on **Cloud Run** in project `blackathon` (region `asia-northeast1`).

This stack provisions:

- **Artifact Registry** Docker repo (`web`) for container images.
- **Firestore** (Native mode, `(default)` database) — the leaderboard datastore.
- **Cloud Run v2** service (`zakuzaku-web`) on container port **8080**, public
  (`allUsers` invoker), scale-to-zero, running as a dedicated **runtime** SA.
- **Secret Manager** secret `GITHUB_OAUTH_CLIENT_SECRET` (value added out-of-band).
- **IAM**: runtime SA (`zakuzaku-run`, `roles/datastore.user` + secret accessor)
  and deployer SA (`gh-deployer`, push/deploy/rules + `actAs` the runtime SA).
- **Workload Identity Federation** so GitHub Actions in
  `a-company-jp/oh-my-blackthunder` deploys with **no JSON key**.

State lives in a **GCS backend** (`prefix = web/prod`); the bucket is
bootstrapped out-of-band (Terraform cannot create the bucket that holds its own
state).

---

## Prerequisites

- `terraform >= 1.7`
- `gcloud` authenticated as a project owner/editor:
  ```bash
  gcloud auth login
  gcloud auth application-default login
  gcloud config set project blackathon
  ```
- Firebase already configured for the project (the user did this).

---

## 1. Bootstrap the state bucket (one time, out-of-band)

```bash
gcloud storage buckets create gs://blackathon-tf-state-web \
  --project=blackathon \
  --location=asia-northeast1 \
  --uniform-bucket-level-access

# Recommended: protect state history.
gcloud storage buckets update gs://blackathon-tf-state-web --versioning
```

## 2. Initialize (partial backend config)

The bucket name is supplied at init time, not hard-coded:

```bash
cd web/terraform
terraform init -backend-config=bucket=blackathon-tf-state-web
```

## 3. (If Firestore already exists) import it first

If the `(default)` Firestore database was already created (e.g. by the Firebase
console), import it before the first apply so Terraform adopts it instead of
trying to create a duplicate:

```bash
terraform import google_firestore_database.default "blackathon/(default)"
```

## 4. First apply (placeholder image)

The Cloud Run service is created with the public placeholder image
(`us-docker.pkg.dev/cloudrun/container/hello`). CI replaces it on the first real
deploy; Terraform ignores later changes to the image/env so it never reverts the
live revision.

```bash
terraform apply -var-file=environments/prod.tfvars
```

## 5. Add the GitHub OAuth client secret value (out-of-band)

The secret resource is created empty by Terraform; add the value directly so it
never lands in state or VCS:

```bash
printf '%s' "<github-oauth-client-secret>" | \
  gcloud secrets versions add GITHUB_OAUTH_CLIENT_SECRET --data-file=-
```

## 6. Wire CI from the Terraform outputs

```bash
terraform output
```

Copy these into the GitHub repo's **Actions variables** (Settings → Secrets and
variables → Actions → Variables) so the deploy workflow can authenticate via WIF
and target the right resources:

| Terraform output             | GitHub Actions variable | Used for                                  |
| ---------------------------- | ----------------------- | ----------------------------------------- |
| `workload_identity_provider` | `WIF_PROVIDER`          | `google-github-actions/auth` provider     |
| `deployer_sa_email`          | `DEPLOYER_SA`           | SA impersonated by `google-github-actions/auth` |
| `artifact_registry_repo`     | `AR_REPO`               | image tag prefix for build/push           |
| `runtime_sa_email`           | `RUNTIME_SA`            | `--service-account` on `gcloud run deploy` |
| `cloud_run_url`              | (informational)         | smoke tests / docs                        |

Also set the `NEXT_PUBLIC_FIREBASE_*` values (from `web/.env.example`) as Actions
variables — they are **build args** baked into the client bundle, not runtime env.

## 7. Deploy the real image (CI)

With WIF wired, the pipeline builds the image, pushes it to
`${artifact_registry_repo}/zakuzaku-web:<sha>`, and runs `gcloud run deploy` /
`firebase deploy --only firestore:rules`. From then on CI owns the running
revision; re-running `terraform apply` will not disturb it.

---

## Post-deploy manual steps

These cannot be expressed in this Terraform and must be done in the consoles:

1. **Firebase Auth → authorized domains** — add the Cloud Run domain (and any
   custom domain) so `signInWithPopup` (GitHub provider) works in production.
   Console: Authentication → Settings → Authorized domains.
2. **GitHub OAuth App → callback URL** — set the Authorization callback URL to
   the Firebase Auth handler for this project, e.g.
   `https://blackathon.firebaseapp.com/__/auth/handler` (and add the production
   site URL if needed). The same OAuth App's **client id** goes into
   `github_oauth_client_id` / `NEXT_PUBLIC_GITHUB_OAUTH_CLIENT_ID`, and its
   **client secret** into Secret Manager (step 5).

---

## File map

| File                     | Concern                                                       |
| ------------------------ | ------------------------------------------------------------ |
| `versions.tf`            | Terraform & provider version constraints                     |
| `backend.tf`             | GCS remote state (partial config)                            |
| `providers.tf`           | `google` / `google-beta` provider config                     |
| `variables.tf`           | Input variables + defaults                                   |
| `apis.tf`                | Enable required Google APIs                                   |
| `artifact_registry.tf`   | Docker repo + cleanup policies                                |
| `firestore.tf`           | `(default)` Firestore database                               |
| `secrets.tf`             | OAuth client-secret secret + runtime SA access               |
| `iam.tf`                 | Runtime & deployer service accounts and roles                |
| `wif.tf`                 | Workload Identity Federation for GitHub Actions              |
| `cloud_run.tf`           | Cloud Run v2 service + public invoker                        |
| `outputs.tf`             | Values consumed by CI                                        |
| `terraform.tfvars.example` | Documented example variables                               |
| `environments/prod.tfvars` | Production variable values                                 |
