import { AzureFunction, Context, HttpRequest } from '@azure/functions'
import { Octokit } from 'octokit'
import { createHmac } from 'crypto'
import { QueryGetProjectV2Item, QueryGetProjectV2Items, ResponseProjectV2Item, ResponseProjectV2Items, ProjectV2ItemFieldIterationValue, ProjectV2ItemFieldNumberValue, ResponseProjectV2Fields, QueryGetProjectV2Fields, QueryUpdateWithinIterationFieldValue } from './graphql-queries'

interface Items {
  id: string
  position: number
  iterationId: string
  storyPoint: number
  actualPoint: number
}

const webhookProcessor: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {

  context.log('HTTP trigger function processed a request.')

  if (process.env.ENVIRONMENT != 'development') {
    // Verify the sent body with x-hub-signature-256 header
    const signature = req.headers['x-hub-signature-256'].replace('sha256=', '')

    const hmac = createHmac('sha256', `${process.env.GITHUB_WEBHOOKS_SECRET}`)
    hmac.update(JSON.stringify(req.body))
    const encoded = hmac.digest('hex')

    if (encoded === signature) {
      context.log('The sent body matches the signature.')
    } else {
      context.log('The sent body does not match the signature.')
      context.res = {
        status: 401,
        body: 'The sent body does not match the signature.'
      }
      return
    }
  }

  // GitHub webhook のペイロードから下記を取得する
  // - アクションの種別
  // - Project V2 のプロジェクトのノードID
  // - Project V2 のアイテムのノードID
  const action = req.body.payload.action
  const projectNodeId = req.body.payload.projects_v2_item.project_node_id
  const itemNodeId = req.body.payload.projects_v2_item.node_id

  // アクションが以下の場合は処理をせず終了する
  // - archived
  // - deleted
  if (action === 'archived' || action === 'deleted') {
    context.log('This action does not need to be processed.')
    context.res = {
      status: 200,
      body: 'Nothing to do.'
    }
    return
  }

  // GitHub GraphQL API を利用して、Project V2 のアイテムの情報を取得する
  const octokit = new Octokit({
    auth: `${process.env.GITHUB_PAT}`
  })

  const responses = await Promise.all([
    octokit.graphql<ResponseProjectV2Item>(QueryGetProjectV2Item, {"projectV2ItemNodeId": itemNodeId}),
    octokit.graphql<ResponseProjectV2Items>(QueryGetProjectV2Items, {projectNodeId}),
    octokit.graphql<ResponseProjectV2Fields>(QueryGetProjectV2Fields, {projectNodeId})
  ])

  // フォーカスするアイテムのイテレーションIDを取得する
  const focusedItem = responses[0]
  const focusedItemIteration = focusedItem.node.fieldValueByName.iterationId

  // Within iteration フィールドとオプションの ID を得る
  const withinIterationField = responses[2].node.fields.nodes.find(field => field.name === 'Within iteration')

  // フォーカスするアイテムと同じイテレーションのアイテムを走査する
  let totalPointWithinTargetIterationUntilFocusedItem = 0
  responses[1].node.items.nodes.every((item, index) => {
    let iterationId
    let storyPoint = 0
    let actualPoint = 0

    // フォーカスするアイテムを見つけたら走査を終了する
    if (item.id === focusedItem.node.id) {
      return false
    }

    // itereationId, storyPoint, actualPoint を取得する
    item.fieldValues.nodes.forEach(fieldValue => {
      if (fieldValue.__typename === 'ProjectV2ItemFieldIterationValue') {
        iterationId = (<ProjectV2ItemFieldIterationValue>fieldValue).iterationId
      } else if (fieldValue.__typename === 'ProjectV2ItemFieldNumberValue') {
        const fieldName = fieldValue.field.name
        if (fieldName === 'Story point') {
          storyPoint = (<ProjectV2ItemFieldNumberValue>fieldValue).number
        } else if (fieldName === 'Actual point') {
          actualPoint = (<ProjectV2ItemFieldNumberValue>fieldValue).number
        }
      }
    })

    // 同じイテレーションのアイテムの場合、それまでの Actual Point または Story point を加算する
    if (iterationId === focusedItemIteration && (actualPoint > 0 || storyPoint > 0)) {
      totalPointWithinTargetIterationUntilFocusedItem += actualPoint > 0 ? actualPoint : storyPoint
    }

    return true
  })

  context.log(`totalPointOfTragetIteration: ${totalPointWithinTargetIterationUntilFocusedItem}`)

  // もしターゲットのイテレーションの合計ポイントにより、Within iteration フィールドの値を設定する
  // 合計ポイントがベロシティを超えている場合は、Over iteration を設定する
  // それ以外は、within iteration を設定する
  const withinIterationFieldTargetOptionValue = totalPointWithinTargetIterationUntilFocusedItem > parseInt(process.env.PROJECT_VELOCITY) ? 'over' : 'within'
  const withinIterationFieldTargetOption = withinIterationField.options.find(option => option.name === withinIterationFieldTargetOptionValue)

  // GitHub GraphQL API を利用して、Project V2 のアイテムの Within iteration カラムを更新する
  await octokit.graphql(QueryUpdateWithinIterationFieldValue, {
    projectNodeId,
    projectV2ItemNodeId: itemNodeId,
    fieldNodeId: withinIterationField.id,
    singleSelectOptionId: withinIterationFieldTargetOption.id
  })

  context.res = {
    status: 200,
    body: 'OK'
  }
}

export default webhookProcessor
