
import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Twitter, Heart, Share, MessageCircle, BarChart2 } from "lucide-react";

interface TweetCardProps {
  content: string;
  date: string;
  metrics?: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
  };
}

export const TweetCard: React.FC<TweetCardProps> = ({
  content,
  date,
  metrics = { likes: 0, retweets: 0, replies: 0, impressions: 0 },
}) => {
  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-2 pt-4 px-4 flex flex-row justify-between items-center">
        <div className="flex items-center gap-2">
          <Twitter className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Tweet</span>
        </div>
        <span className="text-xs text-muted-foreground">{date}</span>
      </CardHeader>
      <CardContent className="px-4 py-3">
        <p className="mb-4 text-sm">{content}</p>
        
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground">
          <div className="flex items-center gap-1 text-xs">
            <Heart className="h-3.5 w-3.5" />
            <span>{metrics.likes}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <Share className="h-3.5 w-3.5" />
            <span>{metrics.retweets}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <MessageCircle className="h-3.5 w-3.5" />
            <span>{metrics.replies}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <BarChart2 className="h-3.5 w-3.5" />
            <span>{metrics.impressions}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TweetCard;
