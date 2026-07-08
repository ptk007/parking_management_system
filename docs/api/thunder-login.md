# Login API Thunder Client Test

This covers only the login/auth flow for the local backend.

## Files

- `docs/api/auth-login.openapi.yaml` - OpenAPI 3.0 spec for Thunder Client import.
- `docs/api/thunder-login.env` - variables for local Thunder Client requests.

## Prerequisites

Start the backend before testing:

```powershell
cd parking-backend
npm run dev
```

If PowerShell blocks `npm.ps1`, use:

```powershell
npm.cmd run dev
```

The local API should return:

```http
GET http://localhost:3000/health
```

Expected response:

```json
{
  "ok": true,
  "database": "connected"
}
```

## Import In Thunder Client

1. Open Thunder Client in VS Code.
2. Import `docs/api/auth-login.openapi.yaml` from the Collection tab.
3. Import or link `docs/api/thunder-login.env` from the Env tab.
4. Set that environment active.

Thunder Client variables use `{{variableName}}`, so requests can use `{{baseUrl}}`, `{{loginUsername}}`, `{{loginPassword}}`, and `{{authToken}}`.

## Test Cases

### 1. Health

```http
GET {{baseUrl}}/health
```

Assertions:

- Status code equals `200`
- `json.ok` equals `true`
- `json.database` equals `connected`

### 2. Login Success

```http
POST {{baseUrl}}/api/auth/login
Content-Type: application/json
```

Body:

```json
{
  "username": "{{loginUsername}}",
  "password": "{{loginPassword}}"
}
```

Assertions:

- Status code equals `200`
- `json.token` exists
- `json.user.username` equals `{{loginUsername}}`
- `json.user.role` equals `staff`

After this request, set environment variable:

- Source: `json.token`
- Value: `{{authToken}}`

### 3. Verify Token

```http
GET {{baseUrl}}/api/auth/verify
Authorization: Bearer {{authToken}}
```

Assertions:

- Status code equals `200`
- `json.valid` equals `true`
- `json.user.username` equals `{{loginUsername}}`

### 4. Login Invalid Password

```http
POST {{baseUrl}}/api/auth/login
Content-Type: application/json
```

Body:

```json
{
  "username": "{{loginUsername}}",
  "password": "wrong-password"
}
```

Assertions:

- Status code equals `401`
- `json.message` equals `Invalid username or password`

### 5. Logout

```http
POST {{baseUrl}}/api/auth/logout
Authorization: Bearer {{authToken}}
```

Assertions:

- Status code equals `200`
- `json.message` equals `Logged out successfully`

## Local Test User

The local MongoDB currently has this dev user for Thunder Client login testing:

```json
{
  "username": "thunder_staff",
  "password": "password123",
  "role": 2,
  "status": 2
}
```
