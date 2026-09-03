import type { ExistingBooking, Venue } from '@/lib/domain/types';

export const demoVenues: Venue[] = [
  {
    id: 'activity-center',
    name: '大学生活动中心',
    capacity: 120,
    equipment: ['投影', '无线麦克风', '基础扩声'],
    availableFrom: '08:00',
    availableTo: '22:00',
  },
  {
    id: 'lecture-hall',
    name: '明德报告厅',
    capacity: 300,
    equipment: ['投影', '无线麦克风', '基础扩声', '舞台灯光', '直播'],
    availableFrom: '08:00',
    availableTo: '21:30',
  },
  {
    id: 'seminar-room',
    name: '博雅研讨室',
    capacity: 48,
    equipment: ['投影', '视频会议'],
    availableFrom: '08:30',
    availableTo: '21:00',
  },
];

export const demoBookings: ExistingBooking[] = [
  {
    venueId: 'activity-center',
    startTime: '2026-09-08T14:00:00+08:00',
    endTime: '2026-09-08T17:00:00+08:00',
    title: '迎新志愿者培训',
  },
  {
    venueId: 'lecture-hall',
    startTime: '2026-09-09T18:30:00+08:00',
    endTime: '2026-09-09T21:00:00+08:00',
    title: '新生第一课',
  },
];

export const demoKnowledge = [
  {
    id: 'KB-VENUE-001',
    title: '学生场地申请管理办法（演示）',
    source: '模拟制度文件 V2026.09',
    content:
      '学生组织申请校内公共场地，应填写活动名称、主办组织、活动时间、预计人数、现场负责人及联系方式。申请人数不得超过场地核定容量。',
  },
  {
    id: 'KB-VENUE-002',
    title: '公共场地设备使用说明（演示）',
    source: '模拟设备说明 V2026.09',
    content:
      '大学生活动中心可提供投影、两支无线麦克风和基础扩声。额外灯光、直播和调音服务需在申请中单独说明，由管理员人工确认。',
  },
  {
    id: 'KB-VENUE-003',
    title: '公共场地开放时间表（演示）',
    source: '模拟开放时间公告 V2026.09',
    content:
      '大学生活动中心开放时间为 08:00 至 22:00，明德报告厅为 08:00 至 21:30，博雅研讨室为 08:30 至 21:00。活动须在开放时间内开始并结束，且不得跨日。',
  },
  {
    id: 'KB-SAFETY-001',
    title: '校园活动安全提示（演示）',
    source: '模拟安全指南 V2026.09',
    content:
      '活动现场负责人应保持电话畅通。预计人数达到场地容量百分之八十以上时，应由审核人员人工复核疏散与秩序维护安排。',
  },
];

