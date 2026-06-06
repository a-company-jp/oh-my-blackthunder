resource "google_firestore_database" "default" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  # No composite index is needed in v1: the leaderboard orders by the single
  # field users.zakuzakuScore, profile lookup is an equality on loginLower, and
  # the activity feed orders by the single field daily.day — all covered by
  # Firestore's automatic single-field indexes (see web/firestore.indexes.json).
  #
  # If the (default) database already exists (e.g. created by the Firebase
  # console), import it before the first apply:
  #   terraform import google_firestore_database.default blackathon/(default)

  depends_on = [google_project_service.services]
}
