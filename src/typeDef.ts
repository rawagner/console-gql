export const typeDefs = `
  scalar JSON
  schema {
    query: Query
    subscription: Subscription
  }

  type ResourceEvent {
    type: String
    objects: JSON
  }





  type ResourceMetadata {
    name: String
    namespace: String
    deletionTimestamp: String
    uid: String
    creationTimestamp: String
    resourceVersion: String
  }

  type PodEvent {
    type: String
    objects: [Pod]
  }

  type ContainerStateValue {
    reason: String
    exitCode: String
    signal: String
  }

  type ContainerState {
    waiting: ContainerStateValue
    running: ContainerStateValue
    terminated: ContainerStateValue
  }

  type ContainerStatus {
    name: String
    state: ContainerState
    lastState: ContainerState
    ready: Boolean
    restartCount: Int
    image: String
    imageID: String
    containerID: String
  }

  type PodStatus {
    phase: String
    message: String
    reason: String
    startTime: String
    containerStatuses: [ContainerStatus]
    initContainerStatuses: [ContainerStatus]
  }

  type Pod {
    apiVersion: String
    kind: String
    metadata: ResourceMetadata
    status: PodStatus
  }
  


  type SelfSubjectAccessReviewStatus {
    allowed: Boolean
  }

  type SelfSubjectAccessReview {
    status: SelfSubjectAccessReviewStatus
  }

  type PodFetchMetadata {
    continue: String
  }


  type PodFetch {
    kind: String,
    apiVersion: String,
    metadata: PodFetchMetadata
    items: [Pod]
  }



  type Query {
    getPods(ns: String, continueToken: String): PodFetch
    urlFetch(url: String): JSON
    selfSubjectAccessReview(group: String, resource: String, verb: String, namespace: String): SelfSubjectAccessReview
    prometheusFetch(url: String): JSON
  }
  type Subscription {
    watchPods(ns: String): PodEvent
    watchResources(apiVersion: String, apiGroup: String, kind: String, plural: String, ns: String, fields: [String]): ResourceEvent
  }
`;