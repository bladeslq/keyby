export type PropertyStatus = 'waiting_photos' | 'draft' | 'published' | 'archived'
export type PropertyType = 'room' | 'studio' | '1k' | '2k' | '3k' | '4k+' | 'house' | 'other'
export type WaAccountStatus = 'connecting' | 'active' | 'disconnected' | 'banned'

export interface Property {
  id: string
  title: string
  address: string | null
  district: string | null
  price: number | null
  deposit: number | null
  type: PropertyType | null
  rooms: number | null
  area: number | null
  floor: number | null
  total_floors: number | null
  lat: number | null
  lng: number | null
  description: string | null
  status: PropertyStatus
  photos: string[]
  source_chat_id: string | null
  source_chat_name: string | null
  source_account: string | null
  sender_phone: string | null
  raw_message: string | null
  property_number: string | null
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  name: string
  phone: string | null
  districts: string[]
  price_min: number | null
  price_max: number | null
  rooms: number[]
  area_min: number | null
  notes: string | null
  agent_id: string | null
  created_at: string
  updated_at: string
}

export interface WaAccount {
  id: string
  phone: string | null
  label: string | null
  status: WaAccountStatus
  chats_count: number
  messages_parsed: number
  last_seen: string | null
  created_at: string
}

export interface WaChat {
  id: string
  account_id: string
  chat_jid: string
  chat_name: string | null
  enabled: boolean
  messages_count: number
  last_message_at: string | null
  created_at: string
}

export const DISTRICTS = [
  'Вахитовский',
  'Авиастроительный',
  'Ново-Савиновский',
  'Московский',
  'Кировский',
  'Приволжский',
  'Советский',
  'Азино',
  'Горки',
  'Дербышки',
  'Салават Купере',
  'Танкодром',
  'Академический',
  'Компрессорный',
  'Борисково',
]

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  room: 'Комната',
  studio: 'Студия',
  '1k': '1-комнатная',
  '2k': '2-комнатная',
  '3k': '3-комнатная',
  '4k+': '4+ комнат',
  house: 'Дом',
  other: 'Другое',
}

export const STATUS_LABELS: Record<PropertyStatus, string> = {
  waiting_photos: 'Ждём фото',
  draft: 'Черновик',
  published: 'Опубликовано',
  archived: 'В архиве',
}
