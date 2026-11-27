import type { Component } from 'vue'
import { CarFront, Clock3, Headphones, LayoutGrid, MapPin, Users, Video, Wrench } from 'lucide-vue-next'

export type GuideRole = 'guest' | 'student' | 'public' | 'staff' | 'admin'

interface GuideStep {
  title: string
  description: string
  icon: Component
  path: string[]
}

interface RoleGuide {
  roleLabel: string
  steps: GuideStep[]
}

const location: GuideStep = {
  title: 'Find a parking space',
  description: 'Open the dashboard filters and choose a building, floor, and vehicle type. Available spaces are green.',
  icon: MapPin,
  path: ['Building', 'Floor', 'Vehicle'],
}

const memberSteps: GuideStep[] = [
  location,
  {
    title: 'Register a vehicle',
    description: 'Select Car or Motor and enter your vehicle details. Choose Confirm, then YES to save it.',
    icon: CarFront,
    path: ['My Vehicles', 'Add vehicle', 'Confirm', 'YES'],
  },
  {
    title: 'View your parking history',
    description: 'Open Parking History to see the parking records for your account.',
    icon: Clock3,
    path: ['My Vehicles', 'Parking History'],
  },
  {
    title: 'Ask Support for help',
    description: 'Enter a subject and describe the problem. Open your request again to see replies.',
    icon: Headphones,
    path: ['MFU Support', 'แจ้งปัญหาใหม่', 'ส่งเรื่องให้ Support'],
  },
]

const parkingLog: GuideStep = {
  title: 'Review parking and slot activity',
  description: 'Use Log to view or export parking records. Slot Status Log shows who changed a slot and when.',
  icon: Clock3,
  path: ['Dashboard', 'Log', 'Export log'],
}

export const roleGuides: Record<GuideRole, RoleGuide> = {
  guest: {
    roleLabel: 'Guest',
    steps: [
      location,
      {
        title: 'Recognize the sample map',
        description: 'When you see Sample map, you are viewing a demonstration. Choose a saved location to check its parking availability.',
        icon: LayoutGrid,
        path: ['Dashboard', 'Sample map'],
      },
    ],
  },
  student: { roleLabel: 'Student', steps: memberSteps },
  public: { roleLabel: 'Public User', steps: memberSteps },
  staff: {
    roleLabel: 'Staff',
    steps: [
      {
        title: 'Manage parking spaces',
        description: 'Choose a saved location and select a slot. Use Enable or Disable when available. Linked cameras update occupied and incoming slots.',
        icon: LayoutGrid,
        path: ['Dashboard', 'Slots', 'Enable / Disable'],
      },
      {
        title: 'Watch a camera',
        description: 'Select an enabled camera and open its live preview.',
        icon: Video,
        path: ['Dashboard', 'CCTV', 'Show live preview'],
      },
      parkingLog,
      {
        title: 'Handle a support request',
        description: 'Select a request, claim it, and reply to the user. Resolve it when the issue is fixed.',
        icon: Headphones,
        path: ['Support Inbox', 'รับเรื่องนี้', 'ปิดเรื่อง'],
      },
    ],
  },
  admin: {
    roleLabel: 'Admin',
    steps: [
      {
        title: 'Set up a parking location',
        description: 'Add a building, then create a floor for the vehicle type it serves.',
        icon: Wrench,
        path: ['Parking Setup', 'Add Building', 'Add Floor'],
      },
      {
        title: 'Add a CCTV preset',
        description: 'Open CCTV for the floor. Import a source JSON file, find the camera, and attach parking-slot JSON to enable detection.',
        icon: Video,
        path: ['Parking Setup', 'CCTV', 'Add CCTV'],
      },
      {
        title: 'Edit a floor map',
        description: 'Disable the floor before editing. Use the E4 default car map or import a JSON map, then edit the layout and link slots to cameras. Save and re-enable the floor.',
        icon: LayoutGrid,
        path: ['Parking Map', 'Use default map slot', 'Layout editor', 'Save Now'],
      },
      {
        title: 'Manage staff accounts',
        description: 'Create staff accounts in Staff Manager. Disable a staff account before editing its details.',
        icon: Users,
        path: ['Staff Manager', 'Add Staff'],
      },
      parkingLog,
    ],
  },
}
