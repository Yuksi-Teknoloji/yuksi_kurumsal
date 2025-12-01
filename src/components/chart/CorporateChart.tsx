"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type CorporateJob = {
  id: string;
  totalPrice?: number;
  commissionRate?: number;
};

export function ChartBar({
  data,
}: {
  data: CorporateJob[];
}) {
  const chart_data = data.map((job) => ({
    name: job.id.trim().length > 10 ? job.id.slice(0, 10) + "..." : job.id,
    value: job.totalPrice! * (job.commissionRate! / 100) || 0,
  }));
    
  return (
    <BarChart
      width={600}
      height={250}
      data={chart_data}
      margin={{
        top: 5,
        right: 30,
        left: 20,
        bottom: 5,
      }}
    >
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="name"/>
      <YAxis />
      <Tooltip formatter={(value, name) => [
        value + " tl" , name
      ]}/>
      <Bar dataKey="value" fill="#8884d8" />
    </BarChart>
  );
}
