# Parking Management System - MongoDB Database Instructions

## Purpose

Create the database for the parking management system using MongoDB with Vue.js and Node.js.

This document follows `docs/database_prompt.txt`.

Do not add database fields, collections, relationships, or conditions that are not written in the prompt.

## Database Type

This database is NoSQL.

MongoDB uses `_id` as the primary identifier for each document. The prompt marks primary keys with `*`. In MongoDB, each marked field should be handled as `_id`.

Example:

| Prompt Field | MongoDB Field | Type |
| --- | --- | --- |
| `user_id*` | `_id` | `ObjectId` |
| `veh_id*` | `_id` | `ObjectId` |
| `parking_id*` | `_id` | `ObjectId` |
| `his_id*` | `_id` | `ObjectId` |
| `park_id*` | `_id` | `ObjectId` |
| `cctv_id*` | `_id` | `ObjectId` |
| `slot_id*` | `_id` | `ObjectId` |

`_id` must not duplicate. It is automatically created by MongoDB.

## Collection Names

Use these collections:

| Prompt Name | MongoDB Collection |
| --- | --- |
| `User` | `users` |
| `Vehicles` | `vehicles` |
| `Parking_zone` | `parking_zone` |
| `History` | `history` |
| `Parking_Log` | `parking_log` |
| `Parking_cctv` | `Parking_cctv` |
| `parking_slots` | `parking_slots` |

## 1. users

### Fields

| Field | Type | Rule |
| --- | --- | --- |
| `_id` | `ObjectId` | Primary identifier from `user_id*` |
| `username` | `String` | From prompt |
| `password` | `String` | From prompt |
| `pin_code` | `String` | From prompt |
| `name` | `String` | From prompt |
| `role` | `Number` | `1 = user`, `2 = staff`, `3 = admin` |
| `status` | `Number` | `1 = online`, `2 = offline`, `3 = disable` |
| `date_add` | `String` | From prompt |
| `time_add` | `String` | From prompt |

### Conditions

- User who has not logged in is `guest`.
- Guest is not collected in database.
- `name` can be reused in another collection.

## 2. vehicles

### Fields

| Field | Type | Rule |
| --- | --- | --- |
| `_id` | `ObjectId` | Primary identifier from `veh_id*` |
| `veh_type` | `Number` | `1 = car`, `2 = motorcycle` |
| `name` | `String` | From prompt |
| `license_num` | `String` | Cannot duplicate |
| `province` | `String` | From prompt |
| `veh_des` | `String` | From prompt |
| `driver_face` | `String` | From prompt |

### Conditions

- In Vue.js and Node.js, always add a duplicate check function for `license_num`.
- `license_num` cannot be duplicated.
- `name` can be reused in another collection.

## 3. parking_zone

### Fields

| Field | Type | Rule |
| --- | --- | --- |
| `_id` | `ObjectId` | Primary identifier from `parking_id*` |
| `building` | `String` or `Number` | From prompt |
| `floor` | `String` or `Number` | From prompt |
| `veh_type` | `Number` | From prompt |
| `date_add` | `String` | From prompt |
| `time_add` | `String` | From prompt |
| `parking_status` | `Number` | `1 = Active`, `2 = Not active`, `3 = Disable` |
| `park_map` | `String` | From prompt |

### Conditions

- Same `building` and same `floor` can duplicate only for one car map and one motorcycle map.
- Otherwise, same `building`, same `floor`, and same `veh_type` cannot duplicate.

## 4. history

### Fields

| Field | Type | Rule |
| --- | --- | --- |
| `_id` | `ObjectId` | Primary identifier from `his_id*` |
| `role` | `Number` | Only staff, value `2` |
| `name` | `String` | From prompt |
| `building` | `String` or `Number` | From prompt |
| `floor` | `String` or `Number` | From prompt |
| `slot_num` | `String` | From prompt |
| `date_edit` | `String` | From prompt |
| `time_edit` | `String` | From prompt |
| `change_to` | `Number` | `1 = Enable`, `2 = Disable` |

### Conditions

- `role` in `history` collection is using only staff or `2`.
- `name` can be reused in another collection.
- `change_to` has `1 = Enable`, `2 = Disable`.

## 5. parking_log

### Fields

| Field | Type | Rule |
| --- | --- | --- |
| `_id` | `ObjectId` | Primary identifier from `park_id*` |
| `building` | `String` or `Number` | From prompt |
| `floor` | `String` or `Number` | From prompt |
| `veh_type` | `Number` | From prompt |
| `name` | `String` | From prompt |
| `license_num` | `String` | From prompt |
| `province` | `String` | From prompt |
| `veh_des` | `String` | From prompt |
| `park_date` | `String` | From prompt |
| `exit_date` | `String` | From prompt |
| `park_time` | `String` | From prompt |
| `exit_time` | `String` | From prompt |
| `park_slot` | `String` | From prompt |
| `park_status` | `Number` | `1 = Parking`, `2 = Exited`, `3 = Not Parking` |
| `face_entrance` | `String` | From prompt |
| `face_exit` | `String` | From prompt |

### Conditions

- `name` can be reused in another collection.

## 6. parking_cctv

### Fields

| Field | Type | Rule |
| --- | --- | --- |
| `_id` | `ObjectId` | Primary identifier from `cctv_id*` |
| `cctv_name` | `String` | From prompt |
| `cctv_link` | `String` | From prompt |
| `cctv_ip` | `String` | From prompt |
| `status` | `String` | From prompt |
| `date_latest` | `String` | From prompt |
| `time_latest` | `String` | From prompt |
| `building` | `String` or `Number` | From prompt |
| `floor` | `String` or `Number` | From prompt |
| `veh_type` | `Number` | From prompt |

## 7. parking_slots

### Fields

| Field | Type | Rule |
| --- | --- | --- |
| `_id` | `ObjectId` | Primary identifier from `slot_id*` |
| `slot_num` | `String` | Cannot duplicate |
| `slot_status` | `Number` | `1 = Avaliable`, `2 = Occupied`, `3 = Incoming`, `4 = Disable` |
| `building` | `String` or `Number` | From prompt |
| `floor` | `String` or `Number` | From prompt |
| `veh_type` | `Number` | From prompt |

### Conditions

- `slot_num` cannot duplicate.

## Required Database Conditions

### User Conditions

| Field | Value | Meaning |
| --- | --- | --- |
| `status` | `1` | online |
| `status` | `2` | offline |
| `status` | `3` | disable |
| `role` | `1` | user |
| `role` | `2` | staff |
| `role` | `3` | admin |

### Parking Slot Conditions

| Field | Value | Meaning |
| --- | --- | --- |
| `slot_status` | `1` | Avaliable |
| `slot_status` | `2` | Occupied |
| `slot_status` | `3` | Incoming |
| `slot_status` | `4` | Disable |

### Parking Zone Conditions

| Field | Value | Meaning |
| --- | --- | --- |
| `parking_status` | `1` | Active |
| `parking_status` | `2` | Not active |
| `parking_status` | `3` | Disable |

### Vehicle Conditions

| Field | Value | Meaning |
| --- | --- | --- |
| `veh_type` | `1` | car |
| `veh_type` | `2` | motorcycle |

### Parking Log Conditions

| Field | Value | Meaning |
| --- | --- | --- |
| `park_status` | `1` | Parking |
| `park_status` | `2` | Exited |
| `park_status` | `3` | Not Parking |

### History Conditions

| Field | Value | Meaning |
| --- | --- | --- |
| `change_to` | `1` | Enable |
| `change_to` | `2` | Disable |

### Building and Floor Conditions

- `building` can be `String` or `Number`.
- `floor` can be `String` or `Number`.
- Same `building` and same `floor` can duplicate only for one car map and one motorcycle map.
- Otherwise, same `building`, same `floor`, and same `veh_type` cannot duplicate.

## Vue.js and Node.js Conditions

The prompt asks:

> If have condition for database. Will create at vue.js and node.js?

Use both:

- Vue.js should check conditions before sending form data.
- Node.js must check conditions again before saving to MongoDB.
- For `vehicles.license_num`, Vue.js and Node.js must always check duplicate license number.
- For `parking_slots.slot_num`, Vue.js and Node.js must always check duplicate slot number.
- For `parking_zone`, Vue.js and Node.js must check duplicate `building`, `floor`, and `veh_type`.
- MongoDB should also prevent duplicate `license_num` by index.

## Required MongoDB Index

The prompt explicitly requires `license_num` cannot duplicate.

```js
db.vehicles.createIndex({ license_num: 1 }, { unique: true })
```

The prompt requires `slot_num` cannot duplicate.

```js
db.parking_slots.createIndex({ slot_num: 1 }, { unique: true })
```

The prompt requires the same `building` and `floor` to allow only one car map and one motorcycle map.

```js
db.parking_zone.createIndex({ building: 1, floor: 1, veh_type: 1 }, { unique: true })
```

## Notes

- Do not store guest users in `users`.
- Do not treat reused `name` values as duplicates.
- Do not add extra collections unless the prompt is updated.
- Do not add extra fields unless the prompt is updated.
