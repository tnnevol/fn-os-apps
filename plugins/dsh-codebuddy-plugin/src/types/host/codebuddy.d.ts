

/** 每个已认证请求上 CodeBuddy 都要求的身份事实。 */
export interface CodeBuddyIdentity {
  accessToken: string
  domain: string
  uid: string
  enterpriseId?: string
  departmentFullName?: string
}
