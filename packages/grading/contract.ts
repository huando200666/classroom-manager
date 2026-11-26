/** Cổng tích hợp tương lai. Không có implementation thực thi mã trong extension. */
export interface GradingSandbox {
  submit(job: {
    assignmentId: string;
    localArchiveReference: string;
    rubricReference: string;
    limits: { memoryMb: number; cpuSeconds: number; network: false };
  }): Promise<{ jobId: string }>;
  result(
    jobId: string,
  ): Promise<{
    status: 'queued' | 'running' | 'complete' | 'failed';
    score?: number;
    feedback?: string;
  }>;
}
