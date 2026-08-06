
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.ProfileScalarFieldEnum = {
  id: 'id',
  platform: 'platform',
  username: 'username',
  fullName: 'fullName',
  avatarUrl: 'avatarUrl',
  overlayId: 'overlayId',
  nicheId: 'nicheId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.NicheScalarFieldEnum = {
  id: 'id',
  nome: 'nome',
  cor: 'cor',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.VideoScalarFieldEnum = {
  id: 'id',
  filename: 'filename',
  minioKey: 'minioKey',
  minioBucket: 'minioBucket',
  thumbnail: 'thumbnail',
  status: 'status',
  errorMsg: 'errorMsg',
  durationMs: 'durationMs',
  width: 'width',
  height: 'height',
  sizeBytes: 'sizeBytes',
  caption: 'caption',
  generatedCaption: 'generatedCaption',
  platform: 'platform',
  nicheId: 'nicheId',
  profileId: 'profileId',
  editConfig: 'editConfig',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OverlayScalarFieldEnum = {
  id: 'id',
  filename: 'filename',
  minioKey: 'minioKey',
  width: 'width',
  height: 'height',
  nicheId: 'nicheId',
  isDefault: 'isDefault',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EditConfigScalarFieldEnum = {
  id: 'id',
  videoId: 'videoId',
  overlayId: 'overlayId',
  overlayBehind: 'overlayBehind',
  posX: 'posX',
  posY: 'posY',
  scale: 'scale',
  zoom: 'zoom',
  volume: 'volume',
  rotation: 'rotation',
  overlayX: 'overlayX',
  overlayY: 'overlayY',
  overlayCropTop: 'overlayCropTop',
  overlayCropBottom: 'overlayCropBottom',
  opacity: 'opacity',
  cropTop: 'cropTop',
  cropBottom: 'cropBottom',
  bgColor: 'bgColor',
  cropColor: 'cropColor',
  cropOpacity: 'cropOpacity',
  speed: 'speed',
  mirror: 'mirror',
  eqEnabled: 'eqEnabled',
  eqBrightness: 'eqBrightness',
  eqContrast: 'eqContrast',
  eqSaturation: 'eqSaturation',
  grain: 'grain',
  grainAmount: 'grainAmount',
  frameDrop: 'frameDrop',
  zoomBreathing: 'zoomBreathing',
  zoomBreathAmount: 'zoomBreathAmount',
  texts: 'texts',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RenderJobScalarFieldEnum = {
  id: 'id',
  videoId: 'videoId',
  status: 'status',
  progress: 'progress',
  outputKey: 'outputKey',
  errorMessage: 'errorMessage',
  batchId: 'batchId',
  createdAt: 'createdAt',
  startedAt: 'startedAt',
  finishedAt: 'finishedAt'
};

exports.Prisma.MetaAccountScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  facebookPageId: 'facebookPageId',
  instagramAccountId: 'instagramAccountId',
  accessToken: 'accessToken',
  tokenExpiresAt: 'tokenExpiresAt',
  refreshToken: 'refreshToken',
  pageName: 'pageName',
  pageUsername: 'pageUsername',
  profilePictureUrl: 'profilePictureUrl',
  isActive: 'isActive',
  connectedAt: 'connectedAt',
  lastSyncedAt: 'lastSyncedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PublicationTemplateScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  name: 'name',
  description: 'description',
  hashtags: 'hashtags',
  platforms: 'platforms',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PublicationScalarFieldEnum = {
  id: 'id',
  metaAccountId: 'metaAccountId',
  tiktokAccountId: 'tiktokAccountId',
  youtubeAccountId: 'youtubeAccountId',
  videoId: 'videoId',
  templateId: 'templateId',
  description: 'description',
  hashtags: 'hashtags',
  platforms: 'platforms',
  scheduledFor: 'scheduledFor',
  publishedAt: 'publishedAt',
  status: 'status',
  method: 'method',
  metaPostId: 'metaPostId',
  metaInsightsUrl: 'metaInsightsUrl',
  errorMessage: 'errorMessage',
  errorCode: 'errorCode',
  retryCount: 'retryCount',
  lastRetryAt: 'lastRetryAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FacebookSessionScalarFieldEnum = {
  id: 'id',
  metaAccountId: 'metaAccountId',
  encryptedCookies: 'encryptedCookies',
  status: 'status',
  loggedInAs: 'loggedInAs',
  fbUserId: 'fbUserId',
  lastUsedAt: 'lastUsedAt',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PublicationLogScalarFieldEnum = {
  id: 'id',
  publicationId: 'publicationId',
  action: 'action',
  metaResponse: 'metaResponse',
  createdAt: 'createdAt'
};

exports.Prisma.TiktokAccountScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  username: 'username',
  displayName: 'displayName',
  profilePictureUrl: 'profilePictureUrl',
  isActive: 'isActive',
  connectedAt: 'connectedAt',
  lastSyncedAt: 'lastSyncedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TiktokSessionScalarFieldEnum = {
  id: 'id',
  tiktokAccountId: 'tiktokAccountId',
  encryptedCookies: 'encryptedCookies',
  status: 'status',
  loggedInAs: 'loggedInAs',
  ttUserId: 'ttUserId',
  lastUsedAt: 'lastUsedAt',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.YoutubeAccountScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  channelName: 'channelName',
  channelId: 'channelId',
  profilePictureUrl: 'profilePictureUrl',
  isActive: 'isActive',
  connectedAt: 'connectedAt',
  lastSyncedAt: 'lastSyncedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.YoutubeSessionScalarFieldEnum = {
  id: 'id',
  youtubeAccountId: 'youtubeAccountId',
  encryptedCookies: 'encryptedCookies',
  status: 'status',
  loggedInAs: 'loggedInAs',
  googleUserId: 'googleUserId',
  lastUsedAt: 'lastUsedAt',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.Platform = exports.$Enums.Platform = {
  INSTAGRAM: 'INSTAGRAM',
  FACEBOOK: 'FACEBOOK',
  YOUTUBE: 'YOUTUBE'
};

exports.Status = exports.$Enums.Status = {
  downloaded: 'downloaded',
  processing: 'processing',
  completed: 'completed',
  error: 'error'
};

exports.RenderStatus = exports.$Enums.RenderStatus = {
  queued: 'queued',
  processing: 'processing',
  completed: 'completed',
  error: 'error',
  cancelled: 'cancelled'
};

exports.Prisma.ModelName = {
  Profile: 'Profile',
  Niche: 'Niche',
  Video: 'Video',
  Overlay: 'Overlay',
  EditConfig: 'EditConfig',
  RenderJob: 'RenderJob',
  MetaAccount: 'MetaAccount',
  PublicationTemplate: 'PublicationTemplate',
  Publication: 'Publication',
  FacebookSession: 'FacebookSession',
  PublicationLog: 'PublicationLog',
  TiktokAccount: 'TiktokAccount',
  TiktokSession: 'TiktokSession',
  YoutubeAccount: 'YoutubeAccount',
  YoutubeSession: 'YoutubeSession'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
