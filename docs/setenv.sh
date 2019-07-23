export resourceGroupName=${heliumprefix}helium
export acrName=${heliumprefix}heliumacr
export appServicePlanName=${heliumprefix}heliumapp
export cosmosDBName=${heliumprefix}cosmosdb
export appInsightsName=${heliumprefix}_Insights
export keyVaultName=${heliumprefix}heliumkeyvault
export webAppName=${heliumprefix}helium

export heliumacrsp=${heliumprefix}heliumacrsp
export heliumacrsp_pull=${heliumprefix}heliumacrsp_pull
export heliumacrsp_push=${heliumprefix}heliumacrsp_push
export heliumacrsp_owner=${heliumprefix}heliumacrsp_owner

export location=eastus

export cosmosDBURL=https://${cosmosDBName}.documents.azure.com:443/
export keyVaultURL=https://${keyVaultName}.vault.azure.net/

# Read the SP info if it exists
if [ -f ~/.ssh/helium_sp_appid ]; then
	export heliumSPAppId=$(cat ~/.ssh/helium_sp_appid)
fi

if [ -f ~/.ssh/helium_sp_pwd ]; then
	export heliumSPpw=$(cat ~/.ssh/helium_sp_pwd)
fi

if [ -f ~/.ssh/helium_sp_tenantid ]; then
	export heliumSPTenantId=$(cat ~/.ssh/helium_sp_tenantid)
fi

if [ -f ~/.ssh/helium_sp_appid_pull ]; then
	export heliumSPAppId_pull=$(cat ~/.ssh/helium_sp_appid_pull)
fi

if [ -f ~/.ssh/helium_sp_pwd_pull ]; then
	export heliumSPpw_pull=$(cat ~/.ssh/helium_sp_pwd_pull)
fi

if [ -f ~/.ssh/helium_sp_appid_push ]; then
	export heliumSPAppId_push=$(cat ~/.ssh/helium_sp_appid_push)
fi

if [ -f ~/.ssh/helium_sp_pwd_push ]; then
	export heliumSPpw_push=$(cat ~/.ssh/helium_sp_pwd_push)
fi

if [ -f ~/.ssh/helium_sp_appid_owner ]; then
	export heliumSPAppId_owner=$(cat ~/.ssh/helium_sp_appid_owner)
fi

if [ -f ~/.ssh/helium_sp_pwd_owner ]; then
	export heliumSPpw_owner=$(cat ~/.ssh/helium_sp_pwd_owner)
fi