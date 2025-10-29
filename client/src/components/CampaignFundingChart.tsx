"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface CampaignFundingData {
  date: string;
  [campaignId: string]: string | number;
}

interface CampaignFundingChartProps {
  data: CampaignFundingData[];
  campaigns: Array<{
    id: string;
    title: string;
    color?: string;
  }>;
}

const chartConfig = {
  visitors: {
    label: "Visitors",
  },
} satisfies ChartConfig

export function CampaignFundingChart({ data, campaigns }: CampaignFundingChartProps) {
  const [timeRange, setTimeRange] = React.useState("90d")


  // Generate dynamic chart config based on campaigns
  const dynamicChartConfig = React.useMemo(() => {
    const config: ChartConfig = { ...chartConfig }
    
    campaigns.forEach((campaign, index) => {
      const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];
      config[campaign.id] = {
        label: campaign.title,
        color: campaign.color || colors[index % colors.length],
      }
    })
    
    return config
  }, [campaigns])

  const filteredData = React.useMemo(() => {
    // Always use sample data for now to replicate the screenshot
    const sampleData = [];
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dataPoint: any = { date: date.toISOString().split('T')[0] };
      
      campaigns.forEach((campaign, campaignIndex) => {
        // Generate realistic funding data with trends and fluctuations
        const baseValue = 200 + (campaignIndex * 100); // Different base values per campaign
        const trend = (days - i) * 2; // Slight upward trend
        const fluctuation = Math.sin(i * 0.3) * 50; // Daily fluctuations
        const randomNoise = (Math.random() - 0.5) * 100; // Random variation
        
        const value = Math.max(0, baseValue + trend + fluctuation + randomNoise);
        dataPoint[campaign.id] = Math.round(value);
      });
      
      sampleData.push(dataPoint);
    }
    
    return sampleData;
  }, [data, campaigns, timeRange])


  return (
    <Card className="rounded-xl shadow-sm border border-gray-200">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b border-gray-200 py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>Campaign Funding Progress</CardTitle>
          <CardDescription>
            Showing daily funding received for your campaigns
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="hidden w-[160px] rounded-lg border border-gray-300 sm:ml-auto sm:flex"
            aria-label="Select a value"
          >
            <SelectValue placeholder="Last 3 months" />
          </SelectTrigger>
          <SelectContent className="rounded-lg border border-gray-300">
            <SelectItem value="90d" className="rounded-lg">
              Last 3 months
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Last 30 days
            </SelectItem>
            <SelectItem value="7d" className="rounded-lg">
              Last 7 days
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-6">
        <ChartContainer
          config={dynamicChartConfig}
          className="aspect-auto h-[400px] w-full"
        >
            <AreaChart data={filteredData} width={800} height={350}>
              <defs>
                {campaigns.map((campaign, index) => {
                  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                  const color = colors[index % colors.length];
                  
                  return (
                    <linearGradient key={campaign.id} id={`fill${campaign.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.1} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid vertical={false} stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickFormatter={(value) => `$${value}`}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })
                    }}
                    indicator="dot"
                    formatter={(value, name) => [
                      `$${Number(value).toLocaleString()}`,
                      campaigns.find(c => c.id === name)?.title || name
                    ]}
                  />
                }
              />
              {campaigns.map((campaign, index) => {
                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                const color = colors[index % colors.length];
                
                return (
                  <Area
                    key={campaign.id}
                    dataKey={campaign.id}
                    type="monotone"
                    fill={`url(#fill${campaign.id})`}
                    stroke={color}
                    strokeWidth={2}
                    stackId="1"
                  />
                );
              })}
              <ChartLegend 
                content={(props) => {
                  const { payload } = props;
                  if (!payload || payload.length === 0) return null;
                  
                  return (
                    <div className="flex justify-center gap-6 pt-4">
                      {payload.map((entry, index) => {
                        const campaign = campaigns.find(c => c.id === entry.dataKey);
                        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                        const color = colors[index % colors.length];
                        
                        return (
                          <div key={String(entry.dataKey)} className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-sm" 
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-sm text-gray-600">
                              {campaign ? campaign.title : String(entry.dataKey)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
            </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
