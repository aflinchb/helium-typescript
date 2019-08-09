# Deploying a Helium Linux Container in Azure App Services for Containers

## Before Starting

Before getting started, make sure to have the [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest) installed on your machine. 

You should also have an active Azure subscription.

## Decide on an Application Prefix and Resource Group Prefix

Azure requires that certain resources have _unique_ names across Azure. In order to do that, it is neccessary to come up with a prefix to prepend to infrastructure item names.  
A good example of a unique prefix that may work would be your login alias or initials (if your alias was _AAA_ for example, your container registry would be named _AAAheliumacr_). Run the commands below to set your desired prefix and set up the naming for your Azure resources.  

If you'd prefer to have custom names and/or choose a custom location, please edit the setenv.sh file directly and run "source ~/helium/docs/setenv.sh

```bash
# Clone the repo (if you haven't already)
git clone https://github.com/microsoft/helium-typescript helium

# Set the desired prefix 
heliumprefix={enter desired prefix}

# Copy a local version of the setenv script to your home directory
cp ~/helium/docs/setenv.sh ~/setenv.sh
chmod +x ~/setenv.sh

# Set environment variables
source ~/setenv.sh

# Optional: Update the script and environment with custom naming/location
nano ~/setenv.sh
source ~/setenv.sh
```

## Installing Required Tools

- Install the [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest)
- Install **jq**
  - Mac: _brew install jq_
  - Debian-based Linux: _sudo apt install jq_

## Setting up Azure Infrastructure

In order for the Helium demonstration to work, Azure infrastructure must first be deployed.  
The following list contains the ordered steps which need to be taken:

1. [Login to Azure](#login-to-azure)
2. [Create the Resource Group](#create-the-resource-group)
3. [Create an Azure Container Registry](#create-an-azure-container-registry)
4. [Create Azure Service Principals](#create-azure-service-principals)
5. [Create your Application Service Plan](#create-your-application-service-plan)
6. [Create and Setup a CosmosDB](#create-and-setup-a-cosmosdb)
7. [Configure Application Insights for Application Monitoring](#configure-application-insights-for-application-monitoring)
8. [Create and Configure an Azure KeyVault](#create-and-configure-an-azure-keyvault)

### Login to Azure

Make sure that the Azure Command Line Interface (CLI) is properly logged in to your Azure account:

```bash
az login

# Example Output:
# Note, we have launched a browser for you to login. For old experience with device code, use # #"az login --use-device-code"
# You have logged in. Now let us find all the subscriptions to which you have access...
# [
#   {
#     "cloudName": "AzureCloud",
#     "id": "zzz0bca0-7a3c-44bd-b54c-4bb1e9zzzzzz",
#     "isDefault": false,
#     "name": "Visual Studio Enterprise",
#     "state": "Enabled",
#     "tenantId": "zzzzzzzz-86f1-41af-zzzz-2d7cd011db47",
#     "user": {
#       "name": "zzzzzzz@microsoft.com",
#       "type": "user"
#     }
#   }, ...
```

If you have multiple subscriptions, make sure that the active subscription is "default".  
We see that the subscription here is not default (isDefault = false). Make this subscription the default one using the below command.  
Replace "Visual Studio Enterprise" with the name of the subscription you want to use.

```bash
az account set -s "Visual Studio Enterprise"
```

You can check if this is the default subscription using the below command

```bash
az account list -o table
```

### Create the Resource Group

The first thing which needs to be done is to create a resource group for Azure to hold the Helium infrastructure.  
To create the resource group execute the following:

```bash
az group create -l $location -n $resourceGroupName

# Example Output:
# {
#   "id": "/subscriptions/zzz0bca0-7a3c-44bd-b54c-4bb1e9zzzzzz/resourceGroups/{app_prefix}helium",
#   "location": "eastus",
#   "managedBy": null,
#   "name": "{app_prefix}helium",
#   "properties": {
#     "provisioningState": "Succeeded"
#   },
#   "tags": null,
#   "type": null
# }
```

### Create an Azure Container Registry

The Azure Container Registry (ACR) is where Docker container images are stored.  
This infrastructure can be created with the following command:

```bash
# Create the ACR and save the Id for Service Principal scope definition.
export acrId=`az acr create -n $acrName -g $resourceGroupName --sku Basic --admin-enabled false -l $location --query id -o tsv` && echo $acrId
```

### Create Azure Service Principals 

You can generate an Azure Service Principal using the [`az ad sp create-for-rbac`](https://docs.microsoft.com/en-us/cli/azure/ad/sp?view=azure-cli-latest#az-ad-sp-create) command with `--skip-assignment` option.  
The `--skip-assignment` parameter limits any additional permissions from being assigned the default [`Contributor`](https://docs.microsoft.com/en-us/azure/role-based-access-control/rbac-and-directory-admin-roles#azure-rbac-roles) role in Azure subscription.

Create service principals:
* One with pull only access to the ACR.
* One with push and pull access to the ACR.
* Optional: One with owner access to the ACR.

Note: You may receive an error if you do not have sufficient permissions on your Azure subscription to create a service principal.  If this happens, contact a subscription administrator to determine whether you have contributor-level access to the subscription.

There are some environments that that perform role assignments during the process of deployments.  In this case, the Service Principal requires Owner level access on the subscription.  Each environment where this is the case will document the requirements and whether or not there is a configuration option not requiring the Owner level privileges.

```bash
# Pull only access
export heliumSPpw_pull=`az ad sp create-for-rbac -n http://$heliumacrsp_pull --query password -o tsv` && echo $heliumSPpw_pull
export heliumSPAppId_pull=`az ad sp show --id http://$heliumacrsp_pull --query appId -o tsv` && echo $heliumSPAppId_pull
export heliumSPTenantId=`az ad sp show --id http://$heliumacrsp_pull --query appOwnerTenantId -o tsv` && echo $heliumSPTenantId
az role assignment create --assignee $heliumSPAppId_pull --role acrpull --scope $acrId

# Push/Pull access
export heliumSPpw_push=`az ad sp create-for-rbac -n http://$heliumacrsp_push --query password -o tsv` && echo $heliumSPpw_push
export heliumSPAppId_push=`az ad sp show --id http://$heliumacrsp_push --query appId -o tsv` && echo $heliumSPAppId_push
az role assignment create --assignee $heliumSPAppId_push --role acrpush --scope $acrId

# Owner access - not needed for deployment, but showing for completeness.
export heliumSPpw_owner=`az ad sp create-for-rbac -n http://$heliumacrsp_owner --query password -o tsv` && echo $heliumSPpw_owner
export heliumSPAppId_owner=`az ad sp show --id http://$heliumacrsp_owner --query appId -o tsv` && echo $heliumSPAppId_owner
az role assignment create --assignee $heliumSPAppId_owner --role owner --scope $acrId
```

```bash
# Create a .ssh folder (if it doesnt already exist)
mkdir ~/.ssh

# Save the SPs for later
echo $heliumSPpw_pull > ~/.ssh/helium_sp_pwd_pull
echo $heliumSPAppId_pull > ~/.ssh/helium_sp_appid_pull
echo $heliumSPTenantId > ~/.ssh/helium_sp_tenantid

echo $heliumSPpw_push > ~/.ssh/helium_sp_pwd_push
echo $heliumSPAppId_push > ~/.ssh/helium_sp_appid_push

# Optional - run if variables were created
echo $heliumSPpw_owner > ~/.ssh/helium_sp_pwd_owner
echo $heliumSPAppId_owner > ~/.ssh/helium_sp_appid_owner
```

### Create your Application Service Plan

In order to deploy a web app, an App Service Plan must first be created:

```bash
az appservice plan create -n $appServicePlanName -g $resourceGroupName --sku S1 --is-linux

# Example Output:
# {
#   "freeOfferExpirationTime": "2019-05-17T17:50:45.863333",
#   "geoRegion": "East US",
#   "hostingEnvironmentProfile": null,
#   "hyperV": false,
#   "id": "/subscriptions/zzz0bca0-7a3c-44bd-b54c-4bb1e9zzzzzz/resourceGroups/{app_prefix}helium/providers/Microsoft.Web/serverfarms/{app_prefix}heliumapp",
#   "isSpot": false,
#   "isXenon": false,
#   "kind": "linux", ...
```

### Create and Setup a CosmosDB

The Helium application will query a CosmosDB instance for data as part of its operation. As such, a database instance will need to be created:

```bash
az cosmosdb create -n $cosmosDBName -g $resourceGroupName

# Example Output:
# {
#   "capabilities": [],
#   "consistencyPolicy": {
#     "defaultConsistencyLevel": "Session",
#     "maxIntervalInSeconds": 5,
#     "maxStalenessPrefix": 100
#   }, ...
```

Next, follow the instructions importing the neccessary data into the CosmosDB instance: [https://github.com/4-co/imdb](https://github.com/4-co/imdb).

### Configure Application Insights for Application Monitoring

We will use Azure Application Insights for application monitoring. First up, we must create the Application Insights instance to use. 

```bash
az resource create -g $resourceGroupName  --resource-type "Microsoft.Insights/components" -n $appInsightsName -l $location -p '{"Application_Type": "Node.JS", "Flow_Type": "Redfield", "Request_Source": "IbizaAIExtension"}'
```

Then, we retrieve the instrumentation key of this instance. 

```bash
export instrumentationKey=`az resource show -g "$resourceGroupName" -n "$appInsightsName" --resource-type "Microsoft.Insights/components" --query properties.InstrumentationKey -o tsv` && echo $instrumentationKey
```

### Create and Configure an Azure KeyVault

An Azure KeyVault is used to store secrets in a safe and secure manner, to create a KeyVault instance:

```bash 
az keyvault create -n $keyVaultName -g $resourceGroupName -l $location

# Example Output:
# {
#   "id": "/subscriptions/7060bca0-zzzz-zzzz-zzzz-4bb1e9facfac/resourceGroups/helium/providers/Microsoft.KeyVault/vaults/{app_prefix}heliumkeyvault",
#   "location": "eastus",
#   "name": "{app_prefix}heliumkeyvault",
#   "properties": {
#     "accessPolicies": [ ...
```

Add the CosmosDB access key as a KeyVault secret by executing the following commands:

```bash
export masterKey=`az cosmosdb keys list -n $cosmosDBName -g $resourceGroupName --query primaryMasterKey -o tsv`
az keyvault secret set --vault-name $keyVaultName -n "cosmosDBkey" --value "$masterKey"

# Example Output:
# {
#   "attributes": {
#     "created": "2019-04-23T16:13:24+00:00",
#     "enabled": true,
#     "expires": null,
#     "notBefore": null,
#     "recoveryLevel": "Purgeable",
#     "updated": "2019-04-23T16:13:24+00:00" ...
```

Add the App Insights key as a KeyVault secret by executing the following command:

```bash
az keyvault secret set --vault-name $keyVaultName -n "AppInsightsInstrumentationKey" --value $instrumentationKey

# Example Output:
# {
#   "attributes": {
#     "created": "2019-04-23T16:13:24+00:00",
#     "enabled": true,
#     "expires": null,
#     "notBefore": null,
#     "recoveryLevel": "Purgeable",
#     "updated": "2019-04-23T16:13:24+00:00" ...
```

Add the SP id and pw for ACR pull as KeyVault secrets and save the ids.  They are needed in the container settings later.

```bash
export acrPullid_KV=`az keyvault secret set --vault-name $keyVaultName -n "acrpullid" --value $heliumSPAppId_pull --query id -o tsv` && echo $acrPullid_KV
export acrPullpw_KV=`az keyvault secret set --vault-name $keyVaultName -n "acrpullpw" --value $heliumSPpw_pull --query id -o tsv` && echo $acrPullpw_KV
```

## Building & Deploying

Now that all neccessary Azure infrastructure has been spun up, it is time to build and push the Helium Docker container image to the ACR. Once that has been completed it will finally be time to deploy the Helium web app.

1. [Build and Push Docker Image to ACR](#build-and-push-docker-image-to-acr)
2. [Deploy the Helium Container Image](#deploy-the-helium-container-image)
3. [Configure Dashboard with Azure Monitor Metrics](#configure-dashboard-with-azure-monitor-metrics)

### Build and Push Docker Image to ACR

It is finally time to build Helium and then push the container image to the ACR that was created earlier. 

Make sure to change to the directory which contains the Helium repository.

Option 1: Use az acr build to build and push the Docker image to your ACR.

```bash
# Login to the ACR
az acr login -n $acrName

# Build and push the Helium container image
az acr build -t ${acrName}.azurecr.io/helium:canary --registry $acrName .
```

Option 2: Use the Docker CLI to build and push the Docker image to your ACR.

```bash
# Login using the SP created earlier with ACR push access
docker login -u $heliumSPAppId_push -p $heliumSPpw_push ${acrName}.azurecr.io

# Build the Helium container image
docker build --target=release -t ${acrName}.azurecr.io/helium:canary .

# Push the Helium container image to your ACR
docker push ${acrName}.azurecr.io/helium:canary
```

### Deploy the Helium container image

And finally, the last set of commands - deploying the web app from the container image! Deploying the Helium container image is as simple as executing the following commands:

Create the web app.

```bash
az webapp create -g $resourceGroupName --plan $appServicePlanName -n $webAppName --deployment-container-image-name ${acrName}.azurecr.io/helium:canary

# Example Output:
# {
#   "availabilityState": "Normal",
#   "clientAffinityEnabled": true,
#   "clientCertEnabled": false,
#   "clientCertExclusionPaths": null,
#   "cloningInfo": null,
#   "containerSize": 0,
#   "dailyMemoryTimeQuota": 0,
#   "defaultHostName": "{prefix}helium.azurewebsites.net" ...
```

Assign an MSI (Managed Service Identity) to the web app and grant it KeyVault read access.

```bash
# Assign the MSI to the web app
export webAppObjectId=`az webapp identity assign -n $webAppName -g $resourceGroupName --query principalId -o tsv` && echo $webAppObjectId

# Grant it KeyVault read access
az keyvault set-policy -n $keyVaultName --secret-permissions get --object-id $webAppObjectId
```

Set environment variables to configure Helium.

```bash
# You can run these all at once
az webapp config appsettings set -g $resourceGroupName -n $webAppName --settings COSMOSDB_URL=$cosmosDBURL
az webapp config appsettings set -g $resourceGroupName -n $webAppName --settings KEY_VAULT_URL=$keyVaultURL
az webapp config appsettings set -g $resourceGroupName -n $webAppName --settings TENANT_ID=$heliumSPTenantId
az webapp config container set -g $resourceGroupName -n $webAppName -i ${acrName}.azurecr.io/helium:canary -r https://${acrName}.azurecr.io -u "@Microsoft.KeyVault(SecretUri=${acrPullid_KV})" -p "@Microsoft.KeyVault(SecretUri=${acrPullpw_KV})"

# Option: Enable continuous deployment if desired
az webapp config appsettings set -g $resourceGroupName -n $webAppName --settings DOCKER_ENABLE_CI=true
```

Note: Database environment variables are automatically set to defaults for the MovieInfo reference app, unless otherwise specified.  
Only run the following if you changed the names from the defaults (DB_NAME=imdb, DB_COLLECTION=movies, DEFAULT_PARTITION_KEY=/key).

```bash
az webapp config appsettings set -g $resourceGroupName -n $webAppName --settings DB_NAME={database name}
az webapp config appsettings set -g $resourceGroupName -n $webAppName --settings DB_COLLECTION={database collection}
az webapp config appsettings set -g $resourceGroupName -n $webAppName --settings DEFAULT_PARTITION_KEY={default partition key}
```

Stop and restart the web app.

```bash
az webapp stop -g $resourceGroupName -n $webAppName 

az webapp start -g $resourceGroupName -n $webAppName 
```

At this point, the web app has been completely deployed! It is now accessible at: **https://${webAppName}.azurewebsites.net/api/movies**. 

### Configure Dashboard with Azure Monitor Metrics

Now that Helium and its supporting infrastructure have been deployed, it's time to create a dashboard to display relevant metrics and logging data:

#### Creating the Dashboard and Tiles
 1. Open the [Azure Portal](https://portal.azure.com)
 2. Navigate to **Dashboard** on the left pane, and then create a new dashboard using the **+ New Dashboard** button
 3. Give the dashboard a name, for example: _Azure App Service dashboard_
 4. From the **Tile Gallery** on the left, add **Metrics chart** two times
 5. Add **Application Map - Application Insights** and **Search - Application Insights**
 6. For Cosmos DB monitoring, add two more **Metrics** charts
 7. Save the dashboard by clicking **Done customizing**


#### Populating the Tiles
1. Click **Configure tile** for Metric chart #1, next click **+ Select a resource**, then select your resource group from the drop down, and select **All resources** - from the list of resources, select the _Azure App service_ plan resource.
2. In the **Metric** drop down, select **CPU percentage**, then click **Update dashboard** on the right
3. Click **Configure tile** for Metric chart #2, repeat the steps as above but now select **Memory percentage** from the **Metric** drop down - click **Update dashboard** to update the configuration
4. Click **Configure tile** for **Application Map** tile, choose the subscription, resource group, and the name of the **Application Insights** instance which was created above
5. Repeat this for the **Search** tile as well and then connect it to the **Application Insights** instance created earlier
6. Click on the two Cosmos DB **Metrics** charts - similar to the above steps, select the resource group and then the cosmos DB resource from the metric dropdown select **Total requests** for one and then **Total Request units** for the other - update the dashboard
7. Now the dashboard contains metrics on CPU and memory usage for the Azure App Service Plan while also providing a way to search through custom logs from the application using the **Search - Application Insights** tile