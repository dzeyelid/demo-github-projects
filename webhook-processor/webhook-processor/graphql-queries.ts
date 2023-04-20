export const QueryGetProjectV2Item = `
  query($projectV2ItemNodeId:ID!) {
    node(id: $projectV2ItemNodeId) {
      id
      ... on ProjectV2Item {
        type
        isArchived
        databaseId
        content {
          ... on DraftIssue {
            body
            title
          }
          ... on Issue {
            body
            title
          }
          ... on PullRequest {
            body
            title
          }
        }
        fieldValueByName(name: "Iteration") {
          ... on ProjectV2ItemFieldIterationValue {
            duration
            iterationId
            startDate
            title
          }
        }
      }
    }
  }
`

export interface ResponseProjectV2Item {
  node: {
    id: string
    fieldValueByName: {
      iterationId: string
    }
  }
}

export const QueryGetProjectV2Items = `
  query($projectNodeId:ID!) {
    node(id: $projectNodeId) {
      id
      __typename
      ... on ProjectV2 {
        items (first: 100) {
          nodes {
            id
            fieldValues(first: 20) {
              nodes {
                __typename
                ... on ProjectV2ItemFieldIterationValue {
                  field {
                    __typename
                    ... on ProjectV2IterationField {
                      name
                    }
                  }
                  duration
                  iterationId
                  startDate
                  title
                }
                ... on ProjectV2ItemFieldNumberValue {
                  field {
                    ... on ProjectV2Field {
                      name
                    }
                  }
                  number
                }
              }
            }
          }
        }
      }
    }
  }
`

export interface ResponseProjectV2Items {
  node: {
    id: string
    items: {
      nodes: [
        {
          id: string
          __typename: string
          fieldValues: {
            nodes: [
              ProjectV2ItemFieldIterationValue | ProjectV2ItemFieldNumberValue
            ]
          }
        }
      ]
    }
  }
}

interface ProjectV2ItemFieldCommon {
  __typename: string
  field: {
    name: string
  }
}

export interface ProjectV2ItemFieldIterationValue extends ProjectV2ItemFieldCommon {
  iterationId: string
}

export interface ProjectV2ItemFieldNumberValue extends ProjectV2ItemFieldCommon {
  number: number
}

export const QueryGetProjectV2Fields = `
  query($projectNodeId:ID!) {
    node(id: $projectNodeId) {
      id
      __typename
      ... on ProjectV2 {
        fields(first: 20) {
          nodes {
            ... on ProjectV2Field {
              id
              __typename
              name
            }
            ... on ProjectV2IterationField {
              id
              __typename
              name
            }
            ... on ProjectV2SingleSelectField {
              id
              __typename
              name
              options {
                id
                name
              }
            }
          }
        }
      }
    }
  }
`

export interface ResponseProjectV2Fields {
  node: {
    id: string
    __typename: string
    fields: {
      nodes: [
        {
          id: string
          __typename: string
          name: string
          options?: [
            {
              id: string
              name: string
            }
          ]
        }
      ]
    }
  }
}

export const QueryUpdateWithinIterationFieldValue = `
  mutation UpdateWithinIterationFieldValue($projectNodeId:ID!, $projectV2ItemNodeId:ID!, $fieldNodeId:ID!, $singleSelectOptionId:String!) {
    updateProjectV2ItemFieldValue (input: {
      fieldId: $fieldNodeId
      itemId: $projectV2ItemNodeId
      projectId: $projectNodeId
      value: {
        singleSelectOptionId: $singleSelectOptionId
      }
    }) {
      projectV2Item {
        id
      }
    }
  }
`
