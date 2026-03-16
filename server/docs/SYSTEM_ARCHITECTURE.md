# Turbo Tll Backend System Architecture

Challenge: **Gemini Live Agent Challenge**

This document explains how the backend works end-to-end: API layers, data flow, background workers, and Cloud Run deployment architecture.

## 1) Backend High-Level Architecture

```mermaid
flowchart TD
    U[Web Frontend<br/>turbotill.xyz] -->|HTTPS + Cookies| A[Express App<br/>app.ts]
    P[Public Table/Live Clients] -->|HTTPS| A

    A --> M1[Security Middleware<br/>helmet, cors, rate-limit]
    A --> M2[Auth Middleware<br/>JWT + CSRF]
    A --> R[API Router<br/>/api/v1]

    R --> RA[Auth Routes]
    R --> RP[Product Routes]
    R --> RG[Agent Routes]
    R --> RO[Order Routes]
    R --> RS[Settings Routes]
    R --> RU[Audit Routes]

    RA --> CA[Auth Controller] --> SA[Auth Service]
    RP --> CP[Product Controller] --> SP[Product Service]
    RG --> CG[Agent Controller] --> SG[Agent Service]
    RO --> CO[Order Controller] --> SO[Order Service]
    RS --> CS[Settings Controller] --> SS[Settings Service]
    RU --> CU[Audit Controller] --> SU[Audit Service]

    SG --> SW[Webhook Delivery Service]
    SO --> SW
    SG --> SL[Gemini Live Service]
    CG --> SL
    SL --> GX[Google Gemini API]

    SA --> GIP[GeoIP Service]
    GIP --> GC[(GeoIpCache)]
    SU --> AJ[(AuditExportJob)]
    SU --> AL[(AuditLog)]

    SA --> DB[(MongoDB Atlas)]
    SP --> DB
    SG --> DB
    SO --> DB
    SS --> DB
    SU --> DB
    GIP --> DB

    A --> UP[/uploads static/]
```

## 2) Cloud Run Deployment Architecture

```mermaid
flowchart LR
    Dev[Developer / CI Trigger] --> B[gcloud builds submit]
    B --> CB[Cloud Build]
    CB --> D1[Build Container<br/>server/Dockerfile]
    D1 --> AR[Artifact Registry]
    AR --> CR[Cloud Run Service<br/>turbotill-api]

    SM[Secret Manager] -->|runtime env injection| CR
    CR --> MDB[(MongoDB Atlas)]
    CR --> GEM[Google Gemini API]
    CR --> WH[External Webhook URLs]

    FE[Frontend<br/>turbotill.xyz] -->|HTTPS| CD[api.turbotill.xyz]
    CD --> CR
```

## 3) Startup and Runtime Lifecycle

1. `server.ts` bootstraps process:
   - connect MongoDB
   - start audit export worker
   - start geo cache metrics monitor
   - start HTTP server on `0.0.0.0:${PORT}`
2. `app.ts` initializes middleware and routes:
   - request logging (`pino-http`)
   - security headers (`helmet`)
   - CORS with `FRONTEND_ORIGIN`
   - global rate limit
   - cookie parser + JSON/form parsing
   - static upload serving (`/${UPLOAD_DIR}`)
   - health endpoints: `/healthz`, `/health`, `/api/v1/health`
3. Graceful shutdown on `SIGINT/SIGTERM`:
   - stop workers
   - disconnect MongoDB
   - enforce shutdown timeout guard

## 4) Request Pipeline (Protected API)

```mermaid
sequenceDiagram
    participant C as Client
    participant E as Express
    participant H as Auth Helpers
    participant Ctrl as Controller
    participant Svc as Service
    participant DB as MongoDB

    C->>E: Request /api/v1/* (cookie + headers)
    E->>H: requireAuth (JWT from cookie/bearer)
    H-->>E: user/session context
    E->>H: requireCsrf (unsafe methods)
    H-->>E: allow/deny
    E->>Ctrl: route handler
    Ctrl->>Svc: business operation
    Svc->>DB: read/write
    DB-->>Svc: result
    Svc-->>Ctrl: response payload
    Ctrl-->>C: JSON success/error envelope
```

## 5) Authentication and Session Rotation

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant API as Auth Controller/Service
    participant S as SessionModel
    participant U as UserModel
    participant A as AuditLog

    UI->>API: POST /auth/login
    API->>U: verify credentials + lockout rules
    API->>S: create refresh session (familyId)
    API->>A: record auth.login
    API-->>UI: set cookies (access, refresh, csrf)

    UI->>API: POST /auth/refresh
    API->>S: validate refresh token hash
    API->>S: rotate session, issue replacement
    API->>A: record auth.refresh_rotated
    API-->>UI: new access/refresh/csrf cookies

    Note over API,S: If rotated token reused -> revoke family + 401 REFRESH_TOKEN_REUSE
```

## 6) Gemini Live Agent End-to-End Flow

### 6.0 One-View System Diagram (Frontend + Backend + Gemini + Order Creation)

Exported assets:

- PNG: `./assets/gemini-live-system-flow.png`
- SVG: `./assets/gemini-live-system-flow.svg`
- Mermaid source: `./diagrams/gemini-live-system-flow.mmd`

![Gemini Live system flow](./assets/gemini-live-system-flow.png)

```mermaid
flowchart LR
    U[User] -->|Voice/Text input| FE[Frontend Web App]
    FE -->|1) Request ephemeral session| BE[Backend API on Cloud Run]
    BE -->|2) Server-authenticated token creation| GL[Gemini Live API]
    GL -->|Ephemeral token| BE
    BE -->|Session token + guardrails| FE

    FE -->|3) Direct realtime stream| GL
    GL -->|4) Realtime response text/audio| FE
    FE -->|Assistant response playback/UI update| U

    FE -->|5) Send transcript + metadata| BE
    BE -->|6) Extract structured order draft| GL
    GL -->|Order draft| BE
    BE -->|7) Validate readiness| DEC{readyToPlace?}
    DEC -- No --> FE
    FE -->|Ask follow-up question| U
    DEC -- Yes --> OS[Order Service]
    OS -->|8) Persist order + timeline| DB[(MongoDB)]
    OS -->|9) Optional webhook notification| WH[Merchant/External Webhook]
    OS -->|10) Final order response| FE
    FE -->|Order placed confirmation| U
```

### 6.1 Frontend + Backend + Gemini Live Interaction

```mermaid
sequenceDiagram
    participant User as End User
    participant FE as Frontend (Browser)
    participant BE as Backend API (Cloud Run)
    participant GL as Gemini Live API
    participant DB as MongoDB

    User->>FE: Starts voice ordering session
    FE->>BE: POST /api/v1/agents/:id/live/session
    BE->>GL: Create ephemeral token (server-side auth)
    GL-->>BE: Ephemeral session token + model info
    BE-->>FE: Token + constraints

    FE->>GL: Open Gemini Live session directly (token-based)
    User->>FE: Speaks order request
    FE->>GL: Stream microphone audio/text chunks
    GL-->>FE: Real-time model response (text/audio)
    FE-->>User: Plays assistant response

    FE->>BE: POST /api/v1/agents/:id/live/conversation-order (conversation transcript)
    BE->>GL: Extract/normalize order draft (LLM + heuristics fallback)
    GL-->>BE: Structured draft (items, customer, confirmation flags)

    alt Draft not ready
      BE-->>FE: readyToPlace=false + ask prompt
      FE-->>User: Ask follow-up question (missing item/name/confirmation)
    else Draft ready
      BE->>DB: Create order + timeline + status
      BE-->>FE: readyToPlace=true + order payload
      FE-->>User: Confirm order placed
    end
```

### 6.2 How Order Placement Completes

```mermaid
flowchart TD
    A[Conversation transcript from frontend] --> B[Backend: createConversationLiveOrder]
    B --> C[Gemini extraction + heuristic validation]
    C --> D{readyToPlace?}
    D -- No --> E[Return ask prompt to frontend]
    E --> F[Frontend asks user follow-up]
    F --> A
    D -- Yes --> G[OrderService.createFromLiveAgent]
    G --> H[(MongoDB: Order, Agent stats, Timeline)]
    G --> I{Webhook configured?}
    I -- Yes --> J[Send signed webhook]
    I -- No --> K[Skip webhook]
    J --> L[Store webhook delivery result]
    K --> L
    L --> M[Return final order response to frontend]
    M --> N[Frontend confirms placement to user]
```

Key behavior:

- Backend is responsible for secure Gemini token issuance and order finalization.
- Frontend handles real-time user interaction (audio capture/playback and conversation UX).
- Order creation only happens after `readyToPlace=true` with valid items + customer name + confirmation.

## 7) Audit Export and Background Workers

```mermaid
flowchart TD
    R1[Audit API request] --> S1[Audit Service]
    S1 -->|small export| I1[Inline CSV/JSON response]
    S1 -->|large export| J1[Create AuditExportJob pending]

    W1[Background Export Worker Timer] --> P1[Scan pending jobs]
    P1 --> P2[Generate export file]
    P2 --> F1[/uploads/exports]
    P2 --> D1[(AuditExportJob status=completed)]

    W2[Geo Cache Monitor Timer] --> M1[Snapshot counters]
    M1 --> D2[(GeoIpMetricSnapshot)]
    M1 --> C1[Cleanup expired GeoIpCache]
```

## 8) Route Domains

- `Auth`: signup/login/refresh/logout/session management/org users
- `Products`: CRUD + bulk create (owner/admin/manager)
- `Agents`: CRUD, toggle, webhook test, live session/order endpoints, public table/live endpoints
- `Orders`: list/detail/create/status updates
- `Settings`: profile/workspace updates + avatar/logo upload
- `Audit`: logs, filters, exports, export jobs, geo-cache metrics

## 9) Core Persistence Models

```mermaid
erDiagram
    USER ||--o{ SESSION : owns
    USER ||--o{ PRODUCT : owns
    USER ||--o{ AGENT : owns
    USER ||--o{ ORDER : owns
    USER ||--o{ AUDITLOG : actor
    USER ||--o{ AUDITSAVEDFILTER : owns
    USER ||--o{ AUDITEXPORTJOB : owns
    USER ||--o{ ORDERCOUNTER : owns
    GEOIPCACHE ||--o{ GEOIPMETRICSNAPSHOT : influences

    USER {
      string email
      string role
      string organizationId
    }
    SESSION {
      string familyId
      string refreshTokenHash
      date expiresAt
      date revokedAt
    }
    PRODUCT {
      string name
      string sku
      number price
      string status
    }
    AGENT {
      string agentType
      string productAccess
      string webhookUrl
      string mode
      bool isActive
    }
    ORDER {
      string orderName
      string source
      string status
      bool webhookDelivered
    }
    AUDITLOG {
      string action
      string entityType
      string actorEmail
    }
    AUDITEXPORTJOB {
      string format
      string status
      string fileUrl
    }
    GEOIPCACHE {
      string ipAddress
      string locationLabel
      date expiresAt
    }
    GEOIPMETRICSNAPSHOT {
      number cacheHits
      number cacheMisses
      number hitRate
    }
```

## 10) Security and Operational Controls

- JWT access tokens + refresh token rotation
- CSRF validation with trusted-origin compatibility fallback
- Role-based authorization (`owner/admin/manager/viewer`)
- Helmet + rate limiting + request/body size limits
- Pino logging with redaction for auth/cookie/password fields
- Upload MIME/type + file-size restrictions
- Structured error mapping (`ApiError`, Zod, Mongoose, Multer)

## 11) Where to Start in Code

- Entry and middleware: `server.ts`, `app.ts`
- Route composition: `src/routes/index.ts`
- Auth/session security: `src/services/auth.service.ts`, `src/helpers/auth.ts`
- Live order orchestration: `src/controllers/agent.controller.ts`, `src/services/gemini-live.service.ts`, `src/services/order.service.ts`
- Auditing/export workers: `src/services/audit.service.ts`
- GeoIP cache/metrics: `src/services/geoip.service.ts`, `src/services/geo-cache-monitor.service.ts`
