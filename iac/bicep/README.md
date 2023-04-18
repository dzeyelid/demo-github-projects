# GitHub webhook を受ける環境をデプロイする

```bash
WORKLOAD="from-redmond"
RESOURCE_GROUP_NAME="rg-${WORKLOAD}"
LOCATION="japaneast"

cd iac/bicep

az login
az group create --name ${RESOURCE_GROUP_NAME} --location ${LOCATION}
az deployment group create --resource-group ${RESOURCE_GROUP_NAME} --template-file main.bicep --parameters workload=${WORKLOAD}
```