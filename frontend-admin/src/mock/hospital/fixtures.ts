/** 医院场景 Mock 数据（设备名、科室、供应商等） */

export const DEPTS = ['重症医学科', '急诊科', '放射科', '检验科', '手术室', '消毒供应中心', '心血管内科']
export const SUPPLIERS = ['联影医疗', '西门子医疗', '飞利浦', '迈瑞医疗', '奥林巴斯', '史赛克']

export const DEVICE_NAMES = [
  '64排CT',
  '1.5T MRI',
  '呼吸机 SV300',
  '监护仪 BeneVision N1',
  '输液泵',
  '注射泵',
  '除颤仪',
  '电子内镜系统',
  '彩超 Resona 7',
  '数字减影血管造影 DSA',
  '全自动生化分析仪',
  '血液透析机',
]

export function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}
