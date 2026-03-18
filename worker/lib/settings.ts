import type {
  DashboardWidgetConfigItem,
  FeatureFlags,
  MenuConfigItem,
  PublicSiteSettings,
  ShellSettings,
  SiteMetadataSettings,
  SiteProfileSettings,
  SocialLink,
} from '@shared/index'
import { APP_NAV_ITEMS, DASHBOARD_WIDGET_KEYS, FEATURE_FLAG_KEYS } from '@shared/index'
import { dhakaNow } from '@shared/utils'
import type { AppBindings } from '../types'
import { boolToInt, dbAll, dbRun, intToBool, jsonObject } from './db'

const featureFlagsCacheKey = 'cache:feature-flags'

const featureFlagMeta = {
  public_catalog_enabled: {
    id: 'flag_public_catalog',
    nameBn: 'পাবলিক ক্যাটালগ',
    nameEn: 'Public catalog',
    descriptionBn: 'পাবলিক ক্যাটালগ সক্রিয় থাকলে সবাই বই খুঁজতে পারবে',
    descriptionEn: 'Allows public visitors to search the catalog',
    visibleToPublic: true,
  },
  competitions_module_enabled: {
    id: 'flag_competitions',
    nameBn: 'প্রতিযোগিতা মডিউল',
    nameEn: 'Competitions module',
    descriptionBn: 'প্রতিযোগিতা মডিউল চালু বা বন্ধ',
    descriptionEn: 'Enable or disable the competitions module',
    visibleToPublic: true,
  },
  online_registration_enabled: {
    id: 'flag_online_registration',
    nameBn: 'অনলাইন রেজিস্ট্রেশন',
    nameEn: 'Online registration',
    descriptionBn: 'অনলাইন নিবন্ধন ফর্ম চালু বা বন্ধ',
    descriptionEn: 'Enable or disable online registration',
    visibleToPublic: true,
  },
  ai_intake_enabled: {
    id: 'flag_ai_intake',
    nameBn: 'AI বুক ইনটেক',
    nameEn: 'AI book intake',
    descriptionBn: 'বইয়ের AI-assisted draft intake চালু বা বন্ধ',
    descriptionEn: 'Enable or disable AI-assisted book intake',
    visibleToPublic: false,
  },
  receipt_export_enabled: {
    id: 'flag_receipt_export',
    nameBn: 'রসিদ এক্সপোর্ট',
    nameEn: 'Receipt export',
    descriptionBn: 'রসিদ/রিপোর্ট এক্সপোর্ট সুবিধা',
    descriptionEn: 'Enable receipt and report exports',
    visibleToPublic: false,
  },
  print_center_enabled: {
    id: 'flag_print_center',
    nameBn: 'প্রিন্ট সেন্টার',
    nameEn: 'Print center',
    descriptionBn: 'বারকোড, QR, ID card এবং লেবেল প্রিন্ট',
    descriptionEn: 'Enable print center features',
    visibleToPublic: false,
  },
} satisfies Record<
  keyof FeatureFlags,
  {
    id: string
    nameBn: string
    nameEn: string
    descriptionBn: string
    descriptionEn: string
    visibleToPublic: boolean
  }
>

const defaultFlags: FeatureFlags = {
  public_catalog_enabled: true,
  competitions_module_enabled: true,
  online_registration_enabled: true,
  ai_intake_enabled: true,
  receipt_export_enabled: true,
  print_center_enabled: true,
}

function defaultProfile(env: AppBindings): SiteProfileSettings {
  return {
    siteNameBn: env.APP_NAME_BN,
    siteNameEn: env.APP_NAME_EN,
    taglineBn: 'বাংলাদেশের কমিউনিটি ও সংগঠনভিত্তিক লাইব্রেরির জন্য',
    taglineEn: 'For community and organizational libraries in Bangladesh',
    logoKey: null,
    faviconKey: null,
  }
}

function defaultMetadata(env: AppBindings): SiteMetadataSettings {
  return {
    metaTitleBn: env.APP_NAME_BN,
    metaTitleEn: env.APP_NAME_EN,
    metaDescriptionBn: 'Bangla-first Public Library Management System',
    metaDescriptionEn:
      'Bangla-first public library management system for Bangladesh libraries',
    canonicalUrl: null,
  }
}

function defaultSocialLinks(): SocialLink[] {
  return [
    {
      id: 'facebook',
      label: 'Facebook',
      url: 'https://facebook.com/',
    },
  ]
}

function defaultMenuConfig(): MenuConfigItem[] {
  return APP_NAV_ITEMS.map((item, index) => ({
    key: item.key,
    enabled: true,
    order: index + 1,
  }))
}

function defaultWidgetConfig(): DashboardWidgetConfigItem[] {
  return DASHBOARD_WIDGET_KEYS.map((key, index) => ({
    key,
    enabled: true,
    order: index + 1,
    minRole:
      key === 'auditFeed'
        ? 'manager'
        : key === 'featureFlags'
          ? 'admin'
          : 'librarian',
  }))
}

function defaultPublicSiteSettings(): PublicSiteSettings {
  return {
    menu: {
      catalog: true,
      competitions: true,
      results: true,
    },
    catalogFields: {
      subtitle: true,
      authors: true,
      publisher: true,
      language: true,
      publicationYear: true,
      edition: true,
      pageCount: true,
      category: true,
      summary: true,
      tags: true,
      availability: true,
      cover: true,
    },
    competition: {
      resultsVisible: true,
      printableAcknowledgement: true,
      showFeeNotice: true,
    },
  }
}

export async function getFeatureFlags(env: AppBindings): Promise<FeatureFlags> {
  const cached = await env.APP_CACHE.get(featureFlagsCacheKey, 'json')
  if (cached) {
    return { ...defaultFlags, ...(cached as FeatureFlags) }
  }

  const rows = await dbAll<{ flag_key: string; enabled: number }>(
    env.DB,
    `SELECT flag_key, enabled FROM feature_flags`,
  )

  const resolvedFlags = { ...defaultFlags }
  for (const row of rows) {
    if (row.flag_key in resolvedFlags) {
      resolvedFlags[row.flag_key as keyof FeatureFlags] = intToBool(row.enabled)
    }
  }

  await env.APP_CACHE.put(featureFlagsCacheKey, JSON.stringify(resolvedFlags), {
    expirationTtl: 120,
  })

  return resolvedFlags
}

export async function saveFeatureFlags(
  env: AppBindings,
  nextFlags: FeatureFlags,
  actorId?: string | null,
): Promise<void> {
  const now = dhakaNow()
  const statements = FEATURE_FLAG_KEYS.map((key) => {
    const meta = featureFlagMeta[key]
    return env.DB.prepare(
      `
        INSERT INTO feature_flags (
          id,
          flag_key,
          name_bn,
          name_en,
          description_bn,
          description_en,
          audience_scope,
          enabled,
          visible_to_public,
          updated_by_user_id,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 'internal', ?, ?, ?, ?)
        ON CONFLICT(flag_key) DO UPDATE SET
          enabled = excluded.enabled,
          visible_to_public = excluded.visible_to_public,
          updated_by_user_id = excluded.updated_by_user_id,
          updated_at = excluded.updated_at
      `,
    ).bind(
      meta.id,
      key,
      meta.nameBn,
      meta.nameEn,
      meta.descriptionBn,
      meta.descriptionEn,
      boolToInt(nextFlags[key]),
      boolToInt(meta.visibleToPublic),
      actorId ?? null,
      now,
    )
  })

  await env.DB.batch(statements)
  await env.APP_CACHE.delete(featureFlagsCacheKey)
}

export async function getAppSettings(db: D1Database) {
  const rows = await dbAll<{ setting_key: string; value_json: string }>(
    db,
    `SELECT setting_key, value_json FROM app_settings`,
  )

  return rows.reduce<Record<string, unknown>>((accumulator, row) => {
    accumulator[row.setting_key] = jsonObject(row.value_json, null)
    return accumulator
  }, {})
}

export async function saveAppSetting(
  db: D1Database,
  key: string,
  value: unknown,
  actorId?: string | null,
): Promise<void> {
  await dbRun(
    db,
    `
      INSERT INTO app_settings (setting_key, value_json, updated_by_user_id, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(setting_key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = excluded.updated_at
    `,
    [key, JSON.stringify(value), actorId ?? null, dhakaNow()],
  )
}

export async function getShellSettings(
  db: D1Database,
  env: AppBindings,
): Promise<ShellSettings> {
  const settings = await getAppSettings(db)

  return {
    profile: {
      ...defaultProfile(env),
      ...(settings.site_profile as Partial<SiteProfileSettings> | undefined),
    },
    metadata: {
      ...defaultMetadata(env),
      ...(settings.site_metadata as Partial<SiteMetadataSettings> | undefined),
    },
    socialLinks:
      (settings.site_social_links as SocialLink[] | undefined) ?? defaultSocialLinks(),
    menuConfig:
      (settings.menu_config as MenuConfigItem[] | undefined) ?? defaultMenuConfig(),
    dashboardWidgets:
      (settings.dashboard_widget_config as DashboardWidgetConfigItem[] | undefined) ??
      defaultWidgetConfig(),
  }
}

export async function getPublicSiteSettings(db: D1Database): Promise<PublicSiteSettings> {
  const settings = await getAppSettings(db)

  return {
    ...defaultPublicSiteSettings(),
    ...(settings.public_site_settings as Partial<PublicSiteSettings> | undefined),
    menu: {
      ...defaultPublicSiteSettings().menu,
      ...((settings.public_site_settings as Partial<PublicSiteSettings> | undefined)?.menu ??
        {}),
    },
    catalogFields: {
      ...defaultPublicSiteSettings().catalogFields,
      ...((settings.public_site_settings as Partial<PublicSiteSettings> | undefined)
        ?.catalogFields ?? {}),
    },
    competition: {
      ...defaultPublicSiteSettings().competition,
      ...((settings.public_site_settings as Partial<PublicSiteSettings> | undefined)
        ?.competition ?? {}),
    },
  }
}

export async function saveShellSettings(
  db: D1Database,
  actorId: string | null,
  settings: ShellSettings,
) {
  await Promise.all([
    saveAppSetting(db, 'site_profile', settings.profile, actorId),
    saveAppSetting(db, 'site_metadata', settings.metadata, actorId),
    saveAppSetting(db, 'site_social_links', settings.socialLinks, actorId),
    saveAppSetting(db, 'menu_config', settings.menuConfig, actorId),
    saveAppSetting(db, 'dashboard_widget_config', settings.dashboardWidgets, actorId),
  ])
}

export async function savePublicSiteSettings(
  db: D1Database,
  actorId: string | null,
  settings: PublicSiteSettings,
) {
  await saveAppSetting(db, 'public_site_settings', settings, actorId)
}
