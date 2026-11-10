import React from "react";
import { UserManagementPage } from "@/modules/vos-admin/user-management";

export const metadata = {
  title: "User Management | LinkBridge",
};

export default function UsersRoute() {
  return <UserManagementPage />;
}
