# ContainerFlow

## Overview
ContainerFlow is a professional mobile waste container management application for iOS, Android, and web. It helps waste management companies track customer containers, manage warehouse inventory, assign pickup/delivery tasks, and monitor operations using QR code scanning. Key features include role-based access control (driver/admin), real-time task management, and comprehensive container tracking with fill-level monitoring. An extension supports specialized automotive factory waste management workflows for box-based material handling.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core System
- **Frontend**: React Native with Expo SDK 54, React Navigation, TanStack React Query for server state, React Context for auth. Custom UI components and React Native Reanimated for animations.
- **Backend**: Node.js with Express.js, RESTful JSON API, Drizzle ORM with PostgreSQL.
- **Data Layer**: PostgreSQL database with schema defined by Drizzle ORM (`shared/schema.ts`). Core entities include `users`, `customers`, `customerContainers`, `warehouseContainers`, `tasks` (with an 8-state lifecycle), `scanEvents`, `activityLogs`, and `fillHistory`.
- **Authentication**: Custom email/password authentication (SHA-256 hashing) and Replit Auth integration. Session management via AsyncStorage. Role-based access control with `ADMIN` and `DRIVER` roles enforced via server-side middleware.
- **Mobile Features**: QR/barcode scanning (`expo-camera`), GPS location (`expo-location`), map deep linking, haptic feedback.
- **QR Code System**: Stable, server-generated QR codes (`{type}-{containerId}`) for permanent container identification. No frontend generation. Admin-only regeneration available.

### Automotive Factory Extension
- **New Entities**: `materials`, `halls`, `stations`, `stands`, `boxes`, `taskEvents`.
- **Automotive Task Lifecycle**: A specialized 7-state lifecycle for box movement (`OPEN` → `PICKED_UP` → `IN_TRANSIT` → `DROPPED_OFF` → `TAKEN_OVER` → `WEIGHED` → `DISPOSED`).
- **Key Design**: Material type is defined by the `Stand`, not the `Box`. `dailyFull` flag on `Stand` for auto-generated daily tasks. Transition guards enforce valid status changes. `weightKg` is required when transitioning to `WEIGHED` status.
- **Admin UI**: `AutomotiveManagementScreen` accessible from Admin Dashboard → "Automotive Fabrik". Tab-based interface for managing Materials, Halls, Stations, Stands, and Boxes with full CRUD operations.
- **API Endpoints**: CRUD for all automotive entities, daily task generation (`POST /api/automotive/daily-tasks/generate`), automotive task creation and status transitions with guards.

## External Dependencies

- **Database**: PostgreSQL (specifically Supabase PostgreSQL). Drizzle ORM for type-safe database access.
- **Mobile Platform Services**: Expo for React Native build and development, `expo-camera` for QR scanning, `expo-location` for GPS, `expo-file-system` and `expo-sharing` for CSV export.
- **Runtime Environment**: Requires `DATABASE_URL` (Supabase connection string), `EXPO_PUBLIC_DOMAIN` for API connectivity, and Replit-specific domain variables.

## Replit Quick Start

- Set secrets in the Replit Secrets panel: `DATABASE_URL`, `EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN:5000`, optional `PORT=5000` (defaults to 5000).
- Install deps once: `npm install`.
- Start everything: `npm run all:dev` (Express on 0.0.0.0:5000 + Expo tunnel with cache cleared).
- Start individually if needed: `npm run server:dev` or `npm run expo:dev`.
- Expo Go: scan the QR code from the Replit console output; ensure phone is on the same network/VPN if tunnel is blocked.
