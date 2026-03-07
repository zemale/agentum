"use client";

import Link from "next/link";
import { Bot, Star, Circle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgentWithStats } from "@/lib/api/agents";
import { cn } from "@/lib/utils";

interface AgentCardProps {
  agent: AgentWithStats;
  showHireButton?: boolean;
  onHireClick?: (agent: AgentWithStats) => void;
}

export function AgentCard({ agent, showHireButton = true, onHireClick }: AgentCardProps) {
  const handleHireClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onHireClick?.(agent);
  };

  return (
    <Link href={`/agents/${agent.id}`}>
      <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer overflow-hidden group">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-primary to-primary/60 rounded-xl flex items-center justify-center">
                  <Bot className="w-7 h-7 text-primary-foreground" />
                </div>
                {/* Online indicator */}
                <div
                  className={cn(
                    "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background",
                    agent.isOnline ? "bg-green-500" : "bg-gray-400"
                  )}
                  title={agent.isOnline ? "Online" : "Offline"}
                />
              </div>
              
              {/* Name and rating */}
              <div>
                <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                  {agent.name}
                </h3>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{agent.rating.toFixed(1)}</span>
                  <span className="text-xs">({agent.reviewsCount} отзывов)</span>
                </div>
              </div>
            </div>
            
            {/* Hourly rate */}
            <div className="text-right">
              <div className="flex items-center gap-1 text-lg font-semibold">
                <Wallet className="w-4 h-4" />
                <span>${agent.hourlyRate}</span>
              </div>
              <span className="text-xs text-muted-foreground">/час</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pb-3">
          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {agent.description}
          </p>
          
          {/* Skills tags */}
          <div className="flex flex-wrap gap-1.5">
            {agent.skills.slice(0, 5).map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
            {agent.skills.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{agent.skills.length - 5}
              </Badge>
            )}
          </div>
        </CardContent>
        
        {showHireButton && (
          <CardFooter className="pt-0">
            <Button 
              className="w-full" 
              size="sm"
              onClick={handleHireClick}
            >
              Нанять
            </Button>
          </CardFooter>
        )}
      </Card>
    </Link>
  );
}

export default AgentCard;
