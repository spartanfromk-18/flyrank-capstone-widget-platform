cat << 'EOF' > README.md
# FlyRank Capstone: Embeddable Widget & Lead-Capture Platform

A production-grade, multi-tenant widget platform that lets customers create embeddable widgets (`<script>` tag) and securely capture visitor submissions from untrusted external origins—fully validated, spam-protected, geo-enriched, and dashboarded[cite: 1, 3, 4, 5].

---

## 🏗️ Architecture Overview

- **Widget Management API:** Tenant-isolated CRUD configuration endpoints[cite: 3, 4].
- **Cached Delivery:** Public config and versioned bundle endpoints optimized with HTTP cache headers (`Cache-Control`)[cite: 4, 5].
- **Hardened Public Submission API:** Cross-origin CORS support, preflight handling, strict Zod boundary validation (`4xx` on bad payloads), and IP rate limiting (`429`)[cite: 4, 5, 8].
- **Abuse & Enrichment Chain:** Honeypot spam filtering and an IP geolocation fallback chain (`ip-api.com` $\rightarrow$ `ipapi.co` $\rightarrow$ graceful degradation)[cite: 5, 8].

---

## 🚀 How to Run Locally

1. Install dependencies:
   ```bash
   npm install