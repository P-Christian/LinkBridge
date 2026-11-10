/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Loader2, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFreelancerProfileContext } from "../providers/FreelancerProfileProvider";
import { searchMasterSkillsAction, addCustomMasterSkillAction } from "../services/freelancer-profile.actions";
import { VsUserSkillMap } from "../types/freelancer-profile.types";
import { toast } from "sonner";

interface CoreSkillsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: number;
    initialSkills: VsUserSkillMap[];
}

export function CoreSkillsModal({ isOpen, onClose, userId, initialSkills }: CoreSkillsModalProps) {
    const [selectedSkills, setSelectedSkills] = useState<{ id: number; skill_name: string }[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<{ id: number; skill_name: string }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isCreatingCustom, setIsCreatingCustom] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const { setSkillsDraft } = useFreelancerProfileContext();
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isOpen) {
            setSelectedSkills(
                initialSkills
                    .filter(s => s.skill)
                    .map(s => ({ id: s.skill.id, skill_name: s.skill.skill_name }))
            );
            setSearchQuery("");
            setSearchResults([]);
            setError(null);
        }
    }, [isOpen, initialSkills]);

    useEffect(() => {
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }

        if (searchQuery.trim().length >= 2) {
            setIsSearching(true);
            debounceTimeout.current = setTimeout(async () => {
                try {
                    const results = await searchMasterSkillsAction(searchQuery.trim());
                    setSearchResults(results);
                } catch (err) {
                    console.error("Search failed:", err);
                } finally {
                    setIsSearching(false);
                }
            }, 300);
        } else {
            setSearchResults([]);
            setIsSearching(false);
        }

        return () => {
            if (debounceTimeout.current) {
                clearTimeout(debounceTimeout.current);
            }
        };
    }, [searchQuery]);

    if (!isOpen) return null;

    const handleSelectSkill = (skill: { id: number; skill_name: string }) => {
        if (!selectedSkills.some(s => s.id === skill.id)) {
            setSelectedSkills(prev => [...prev, skill]);
        }
        setSearchQuery("");
        setSearchResults([]);
    };

    const handleCreateCustomSkill = async () => {
        const trimmed = searchQuery.trim();
        if (!trimmed) return;

        setIsCreatingCustom(true);
        setError(null);
        try {
            const skill = await addCustomMasterSkillAction(trimmed);
            if (!selectedSkills.some(s => s.id === skill.id)) {
                setSelectedSkills(prev => [...prev, skill]);
            }
            setSearchQuery("");
            setSearchResults([]);
            toast.success(`Added "${skill.skill_name}" as a skill.`);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to create custom skill.";
            setError(msg);
            toast.error(msg);
        } finally {
            setIsCreatingCustom(false);
        }
    };

    const handleRemoveSkill = (skillId: number) => {
        setSelectedSkills(prev => prev.filter(s => s.id !== skillId));
    };

    const handleSave = () => {
        setIsSaving(true);
        setError(null);
        try {
            const draftedSkills = selectedSkills.map(s => ({
                user_id: userId,
                skill_id: s.id,
                skill: { id: s.id, skill_name: s.skill_name }
            })) as VsUserSkillMap[];
            
            setSkillsDraft(draftedSkills);
            onClose();
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "Failed to update skills draft.";
            setError(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    const hasExactMatch = searchResults.some(
        s => s.skill_name.toLowerCase() === searchQuery.trim().toLowerCase()
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-background rounded-xl shadow-lg flex flex-col max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b shrink-0">
                    <h2 className="text-xl font-semibold text-foreground">Manage Core Skills</h2>
                    <Button variant="ghost" size="icon" onClick={onClose} disabled={isSaving || isCreatingCustom} className="max-md:size-11">
                        <X className="h-5 w-5" />
                    </Button>
                </div>
                
                <div className="p-6 overflow-visible flex-1 flex flex-col gap-6">
                    {error && (
                        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                            {error}
                        </div>
                    )}
                    
                    {/* Combobox Search */}
                    <div className="space-y-2 relative">
                        <label className="text-sm font-medium text-foreground">Search and Add Skills</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-md border border-input bg-transparent text-base md:text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Type to search or add custom skill..."
                                disabled={isSaving || isCreatingCustom}
                            />
                            {(isSearching || isCreatingCustom) && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                        </div>

                        {/* Search Results Dropdown */}
                        {searchQuery.trim().length >= 2 && !isSearching && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-popover text-popover-foreground border rounded-md shadow-md z-10 max-h-60 overflow-y-auto divide-y divide-border">
                                {searchResults.map((skill) => (
                                    <button
                                        key={skill.id}
                                        type="button"
                                        className="w-full text-left px-4 py-2 text-sm hover:bg-muted focus:bg-muted transition-colors disabled:opacity-50 flex items-center justify-between"
                                        onClick={() => handleSelectSkill(skill)}
                                        disabled={selectedSkills.some(s => s.id === skill.id)}
                                    >
                                        <span>{skill.skill_name}</span>
                                        {selectedSkills.some(s => s.id === skill.id) && (
                                            <span className="text-sm md:text-xs text-muted-foreground">Added</span>
                                        )}
                                    </button>
                                ))}

                                {!hasExactMatch && (
                                    <button
                                        type="button"
                                        className="w-full text-left px-4 py-2.5 text-sm text-primary hover:bg-primary/5 font-medium flex items-center justify-between"
                                        onClick={handleCreateCustomSkill}
                                        disabled={isCreatingCustom}
                                    >
                                        <span>+ Add &quot;{searchQuery.trim()}&quot; as a custom skill</span>
                                        <Plus className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Selected Skills Table */}
                    <div className="space-y-2 flex-1 flex flex-col min-h-[200px]">
                        <label className="text-sm font-medium text-foreground">Selected Skills</label>
                        <div className="border rounded-md p-4 flex-1 flex flex-wrap content-start gap-2 bg-muted/10 overflow-y-auto max-h-[300px]">
                            {selectedSkills.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic text-center w-full mt-10">
                                    No skills selected. Search and click above to add skills.
                                </p>
                            ) : (
                                selectedSkills.map((skill) => (
                                    <Badge key={skill.id} variant="outline" className="pl-3 pr-1 py-1.5 flex items-center gap-1 border-primary text-primary bg-primary/5 text-sm h-9">
                                        {skill.skill_name}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 rounded-full hover:bg-primary/20 text-primary hover:text-primary shrink-0 ml-1 max-md:h-auto max-md:w-auto max-md:p-3.5 max-md:-m-2.5"
                                            onClick={() => handleRemoveSkill(skill.id)}
                                            disabled={isSaving}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </Badge>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t flex justify-end gap-3 bg-muted/20">
                    <Button variant="outline" onClick={onClose} disabled={isSaving} className="max-md:min-h-11">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 max-md:min-h-11"
                    >
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </Button>
                </div>
            </div>
        </div>
    );
}
