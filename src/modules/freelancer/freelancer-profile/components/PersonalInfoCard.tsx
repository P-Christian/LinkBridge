"use client";

import React, { useState, useRef } from "react";
import { User, Mail, MapPin, Briefcase, Camera } from "lucide-react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faGitlab, faLinkedin, faXTwitter, faYoutube, faFacebook } from '@fortawesome/free-brands-svg-icons';
import { faGlobe } from '@fortawesome/free-solid-svg-icons';
import { useFreelancerProfileContext } from "../providers/FreelancerProfileProvider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { uploadProfileImageAction } from "../services/freelancer-profile.actions";
import { PersonalInfoModal } from "./PersonalInfoModal";
import { useEffect } from "react";
import { formatAssetUrl } from "@/lib/utils";

export function PersonalInfoCard() {
    const { data, pendingPersonalInfo, pendingSocialLinks, refresh, isAutofilling } = useFreelancerProfileContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [idProofScore, setIdProofScore] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch("/api/freelancer/id-proof-score")
            .then(res => res.json())
            .then(resData => {
                if (resData && typeof resData.score === 'number') {
                    setIdProofScore(resData.score);
                }
            })
            .catch(err => console.error("Failed to fetch ID proof score:", err));
    }, []);

    if (!data) return null;

    // Use pending draft values if they exist, otherwise fallback to live data
    const displayData = { ...data, ...pendingPersonalInfo };
    const displaySocialLinks = pendingSocialLinks !== null ? pendingSocialLinks : (data.social_links || []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("title", file.name);
            formData.append("file", file);
            const res = await uploadProfileImageAction(data.user_id, formData);
            if (res.success) {
                await refresh();
            } else {
                console.error("Failed to upload profile image:", res.error);
            }
        } catch (err) {
            console.error("Error uploading image:", err);
        } finally {
            setIsUploading(false);
        }
    };

    const getPlatformIcon = (platform: string) => {
        switch (platform) {
            case 'Github': return <FontAwesomeIcon icon={faGithub} className="text-2xl" />;
            case 'GitLab': return <FontAwesomeIcon icon={faGitlab} className="text-2xl" />;
            case 'LinkedIn': return <FontAwesomeIcon icon={faLinkedin} className="text-2xl" />;
            case 'X (Twitter)': return <FontAwesomeIcon icon={faXTwitter} className="text-2xl" />;
            case 'YouTube': return <FontAwesomeIcon icon={faYoutube} className="text-2xl" />;
            case 'Facebook': return <FontAwesomeIcon icon={faFacebook} className="text-2xl" />;
            case 'Personal Portfolio': return <FontAwesomeIcon icon={faGlobe} className="text-2xl" />;
            case 'Other': return <FontAwesomeIcon icon={faGlobe} className="text-2xl" />;
            default: return <FontAwesomeIcon icon={faGlobe} className="text-2xl" />;
        }
    };

    const isComplete = Boolean(
        displayData.user_fname && 
        displayData.user_lname && 
        displayData.user_bday && 
        displayData.gender && 
        displayData.user_contact && 
        displayData.user_province && 
        displayData.user_city
    );

    return (
        <div className="bg-card text-card-foreground border rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Personal Information</h2>
                    {isComplete ? (
                        <div className="ml-1 flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-500" title="Personal info complete">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                    ) : (
                        <div className="ml-1 flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground" title="Personal info incomplete">
                            <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                        </div>
                    )}
                    {idProofScore !== null && (
                        <div className={`ml-3 px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 ${idProofScore >= 80 ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/30' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/30'}`}>
                            ID Proof: {idProofScore}%
                        </div>
                    )}
                </div>
                <Button variant="ghost" size="sm" className="h-8 text-primary font-medium relative max-md:min-h-11" onClick={() => setIsModalOpen(true)} disabled={isAutofilling}>
                    Edit
                    {pendingPersonalInfo && (
                        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary border-2 border-background"></span>
                    )}
                </Button>
            </div>

            {isAutofilling ? (
                <div className="p-6 flex flex-col md:flex-row gap-4 md:gap-8 items-start">
                    <div className="flex flex-col items-center gap-4 w-full md:w-64 shrink-0">
                        <Skeleton className="w-48 h-48 rounded-full" />
                        <Skeleton className="w-full h-8" />
                        <Skeleton className="w-full h-8 mt-1" />
                    </div>
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 w-full">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-5 w-40" />
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="p-6 flex flex-col md:flex-row gap-4 md:gap-8 items-start">
                    {/* Left Column: Profile Picture */}
                    <div className="flex flex-col items-center gap-4 w-full md:w-64 shrink-0">
                        <div className="relative w-48 h-48 rounded-full overflow-hidden border-2 border-border shadow-sm group">
                            {displayData.profile_image_url ? (
                                /* eslint-disable @next/next/no-img-element */
                                <img
                                    src={formatAssetUrl(displayData.profile_image_url) || ""}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
                                    <User className="h-16 w-16" />
                                </div>
                            )}
                            {isUploading && (
                                <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                                    <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></span>
                                </div>
                            )}
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 text-sm md:text-xs h-8 max-md:min-h-11"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                        >
                            <Camera className="h-3.5 w-3.5" />
                            Change Photo
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                        
                        <Button
                            variant="default"
                            size="sm"
                            className="w-full gap-2 text-sm md:text-xs h-8 mt-1 max-md:min-h-11"
                            onClick={() => window.location.href = '/linkbridge/freelancer/verify-identity'}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path></svg>
                            Verify Identity
                        </Button>
                    </div>

                    {/* Right Column: Personal Info & Social Links */}
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 w-full">
                    <div>
                        <label className="text-sm md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Full Name</label>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                                {displayData.user_fname} {displayData.user_mname ? displayData.user_mname + ' ' : ''}{displayData.user_lname} {displayData.suffix_name || ''}
                            </span>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Primary Role</label>
                        <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-muted-foreground hidden" />
                            <span className="font-medium text-foreground">{displayData.user_position || 'Not specified'}</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Email Address</label>
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground hidden" />
                            <span className="font-medium text-foreground">{displayData.user_email}</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Contact Number</label>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{displayData.user_contact || 'Not specified'}</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Location</label>
                        <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground hidden" />
                            <span className="font-medium text-foreground">
                                {[displayData.user_brgy, displayData.user_city, displayData.user_province].filter(Boolean).join(', ') || 'Not specified'}
                            </span>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Gender</label>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{displayData.gender || 'Not specified'}</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Birthday</label>
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{displayData.user_bday || 'Not specified'}</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm md:text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Social Links</label>
                        <div className="flex flex-wrap items-center gap-3">
                            {displaySocialLinks.length > 0 ? (
                                displaySocialLinks.map((link) => (
                                    <a
                                        key={link.id}
                                        href={link.profile_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-muted-foreground hover:text-primary transition-colors max-md:size-11 max-md:grid max-md:place-items-center"
                                        title={link.platform_name}
                                    >
                                        {getPlatformIcon(link.platform_name)}
                                    </a>
                                ))
                            ) : (
                                <span className="text-sm font-medium text-foreground">Not specified</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            )}

            <PersonalInfoModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </div>
    );
}
