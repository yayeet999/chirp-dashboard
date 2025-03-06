
import React from "react";
import { cn } from "@/lib/utils";

type Status = "active" | "inactive" | "error";

interface StatusBadgeProps {
  status: Status;
  label?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className,
}) => {
  const statusClasses = {
    active: "bg-green-500/15 text-green-500 border-green-500/20",
    inactive: "bg-amber-500/15 text-amber-500 border-amber-500/20", 
    error: "bg-red-500/15 text-red-500 border-red-500/20",
  };
  
  const statusLabels = {
    active: "Active",
    inactive: "Inactive",
    error: "Error",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusClasses[status],
        className
      )}
    >
      <span className={`status-indicator status-${status}`} />
      {label || statusLabels[status]}
    </span>
  );
};

export default StatusBadge;
