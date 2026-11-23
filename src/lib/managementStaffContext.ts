import { createContext, useContext } from 'react'
import type { StaffProfile } from './session'

export const ManagementStaffContext = createContext<StaffProfile | null>(null)

export function useManagementStaff() {
  return useContext(ManagementStaffContext)
}
