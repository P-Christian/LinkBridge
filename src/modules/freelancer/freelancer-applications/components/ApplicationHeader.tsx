"use client";

import React from 'react';


interface Props {
  totalOpportunities: number;
}

export const ApplicationHeader: React.FC<Props> = ({ 
  totalOpportunities, 
}) => {
  return (
    <div className="flex flex-col justify-start mb-6 gap-1 border-b pb-4">
      <h2 className="text-lg font-bold text-foreground">Application History</h2>
      <p className="text-muted-foreground text-sm md:text-xs">
        Track your journey across {totalOpportunities} active opportunit{totalOpportunities === 1 ? 'y' : 'ies'}.
      </p>
    </div>
  );
};
