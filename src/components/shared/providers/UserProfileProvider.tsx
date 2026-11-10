"use client";

import React, { createContext, useContext } from "react";

export type UserProfile = {
    name: string;
    email: string;
    avatar: string;
    role?: string;
    role_id?: number;
    verification_status?: string;
    status?: string;
    status_version?: number;
};

const UserProfileContext = createContext<UserProfile | null>(null);

export function UserProfileProvider({
    user,
    children,
}: {
    user: UserProfile;
    children: React.ReactNode;
}) {
    return (
        <UserProfileContext.Provider value={user}>
            {children}
        </UserProfileContext.Provider>
    );
}

export function useUserProfile() {
    const context = useContext(UserProfileContext);
    if (context === undefined) {
        throw new Error("useUserProfile must be used within a UserProfileProvider");
    }
    // Return a default if no context is provided (e.g. outside of the provider layout)
    return context || { name: "Guest", email: "guest@example.com", avatar: "" };
}
