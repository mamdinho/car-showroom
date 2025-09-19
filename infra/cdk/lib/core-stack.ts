// infra/cdk/lib/core-stack.ts
import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamo from "aws-cdk-lib/aws-dynamodb";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";

// Resolve from the CDK app CWD (infra/cdk) to repo root, then into target
const fromCdk = (...segs: string[]) => path.resolve(process.cwd(), "..", "..", ...segs);

export class CoreStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const app = "carshowroom";
    const stage = this.node.tryGetContext("stage") ?? "dev";

    // ---------- DynamoDB ----------
    const cars = new dynamo.Table(this, "Cars", {
      tableName: `${stage}-cars`,
      partitionKey: { name: "carId", type: dynamo.AttributeType.STRING },
      billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const users = new dynamo.Table(this, "Users", {
      tableName: `${stage}-users`,
      partitionKey: { name: "userId", type: dynamo.AttributeType.STRING },
      billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const bookings = new dynamo.Table(this, "Bookings", {
      tableName: `${stage}-bookings`,
      partitionKey: { name: "bookingId", type: dynamo.AttributeType.STRING },
      billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // ---------- Cognito ----------
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `${app}-${stage}-user-pool`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      passwordPolicy: { minLength: 8, requireLowercase: true, requireUppercase: true, requireDigits: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const redirectUri = this.node.tryGetContext("redirectUri") ?? "http://localhost:3000/auth/callback";
    const logoutUri = this.node.tryGetContext("logoutUri") ?? "http://localhost:3000/";

    const userClient = new cognito.UserPoolClient(this, "UserClient", {
      userPool,
      userPoolClientName: `${app}-${stage}-user-client`,
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [redirectUri],
        logoutUrls: [logoutUri],
  },
    });

    const domainPrefix = `${app}-${stage}-${this.account.slice(-4)}`.toLowerCase();

    const userPoolDomain = new cognito.UserPoolDomain(this, "UserPoolDomain", {
      userPool,
      cognitoDomain: { domainPrefix }, 
    });

    new cognito.CfnUserPoolGroup(this, "AdminGroup", { groupName: "admin", userPoolId: userPool.userPoolId });
    new cognito.CfnUserPoolGroup(this, "CustomerGroup", { groupName: "customer", userPoolId: userPool.userPoolId });

    // ---------- S3 ----------
    const webBucket = new s3.Bucket(this, "WebBucket", {
      bucketName: `${app}-${stage}-web`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const imagesBucket = new s3.Bucket(this, "ImagesBucket", {
      bucketName: `${app}-${stage}-images`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.HEAD],
        allowedOrigins: ["*"],          // tighten later to your domain(s) if you want
        allowedHeaders: ["*"],
        exposedHeaders: ["ETag"]
      }],
    });

    // ---------- CloudFront ----------
    const webOrigin = origins.S3BucketOrigin.withOriginAccessControl(webBucket);
    const imagesOrigin = origins.S3BucketOrigin.withOriginAccessControl(imagesBucket);

    const dist = new cloudfront.Distribution(this, "WebDist", {
      comment: `${app}-${stage}-distribution`,
      defaultBehavior: { origin: webOrigin },
      additionalBehaviors: { "/images/*": { origin: imagesOrigin } },
    });

    // Allow CloudFront (this distribution) to read objects from the IMAGES bucket
    imagesBucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: "AllowCloudFrontReadImages",
      actions: ["s3:GetObject"],
      resources: [imagesBucket.arnForObjects("*")],
      principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
      conditions: {
        StringEquals: { "AWS:SourceArn": dist.distributionArn },
      },
    }));

    webBucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: "AllowCloudFrontReadWeb",
      actions: ["s3:GetObject"],
      resources: [webBucket.arnForObjects("*")],
      principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
      conditions: {
        StringEquals: { "AWS:SourceArn": dist.distributionArn },
      },
    }));

    // ---------- Lambdas ----------
    const carFn = new lambdaNodejs.NodejsFunction(this, "CarFn", {
      functionName: `${stage}-car-service`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: fromCdk("apps/services/cars/src/index.ts"),
      handler: "handler",
      timeout: Duration.seconds(10),
      environment: { CARS_TABLE: cars.tableName, IMAGES_BUCKET: imagesBucket.bucketName },
    });
    cars.grantReadWriteData(carFn);
    imagesBucket.grantReadWrite(carFn);

    const bookingsFn = new lambdaNodejs.NodejsFunction(this, "BookingsFn", {
      functionName: `${stage}-bookings-service`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: fromCdk("apps/services/bookings/src/index.ts"),
      handler: "handler",
      timeout: Duration.seconds(10),
      environment: { BOOKINGS_TABLE: bookings.tableName, CARS_TABLE: cars.tableName },
    });
    bookings.grantReadWriteData(bookingsFn);
    cars.grantReadData(bookingsFn);

    const usersFn = new lambdaNodejs.NodejsFunction(this, "UsersFn", {
      functionName: `${stage}-users-service`,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: fromCdk("apps/services/users/src/index.ts"),
      handler: "handler",
      timeout: Duration.seconds(10),
      environment: {
        USERS_TABLE: users.tableName,
        USER_POOL_ID: userPool.userPoolId,
        IMAGES_BUCKET: imagesBucket.bucketName, // for avatar upload
      },
    });
    users.grantReadWriteData(usersFn);
    imagesBucket.grantWrite(usersFn);

    // ---------- API Gateway ----------
    const authorizer = new authorizers.HttpUserPoolAuthorizer("JwtAuth", userPool, { userPoolClients: [userClient] });
    const httpApi = new apigwv2.HttpApi(this, "Api", {
      apiName: `${app}-${stage}-api`,
      corsPreflight: { allowHeaders: ["*"], allowMethods: [apigwv2.CorsHttpMethod.ANY], allowOrigins: ["*"] },
    });

    // ===== Cars =====
    // Public GETs (no authorizer)
    httpApi.addRoutes({
      path: "/cars",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("CarsPublicList", carFn),
    });
    httpApi.addRoutes({
      path: "/cars/{id}",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("CarPublicGet", carFn),
    });

    // Authenticated mutations
    httpApi.addRoutes({
      path: "/cars",
      methods: [apigwv2.HttpMethod.POST],
      authorizer,
      integration: new integrations.HttpLambdaIntegration("CarsCreate", carFn),
    });
    httpApi.addRoutes({
      path: "/cars/{id}",
      methods: [apigwv2.HttpMethod.PUT, apigwv2.HttpMethod.DELETE],
      authorizer,
      integration: new integrations.HttpLambdaIntegration("CarMutate", carFn),
    });
    httpApi.addRoutes({
      path: "/cars/{id}/image-upload-url",
      methods: [apigwv2.HttpMethod.POST],
      authorizer,
      integration: new integrations.HttpLambdaIntegration("CarImageUpload", carFn),
    });

    // ===== Bookings (auth) =====
    httpApi.addRoutes({
      path: "/bookings",
      methods: [apigwv2.HttpMethod.POST],
      authorizer,
      integration: new integrations.HttpLambdaIntegration("BookingsInt", bookingsFn),
    });
    httpApi.addRoutes({
      path: "/bookings/me",
      methods: [apigwv2.HttpMethod.GET],
      authorizer,
      integration: new integrations.HttpLambdaIntegration("MyBookingsInt", bookingsFn),
    });
    httpApi.addRoutes({
      path: "/bookings/{id}",
      methods: [apigwv2.HttpMethod.PATCH],
      authorizer,
      integration: new integrations.HttpLambdaIntegration("BookingInt", bookingsFn),
    });

    // ===== Users (auth) =====
    httpApi.addRoutes({
      path: "/users/me",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT],
      authorizer,
      integration: new integrations.HttpLambdaIntegration("UsersInt", usersFn),
    });
    httpApi.addRoutes({
      path: "/users/me/avatar-upload-url",
      methods: [apigwv2.HttpMethod.POST],
      authorizer,
      integration: new integrations.HttpLambdaIntegration("UserAvatarInt", usersFn),
    });
    httpApi.addRoutes({
      path: "/admin/users",
      methods: [apigwv2.HttpMethod.GET],
      authorizer,
      integration: new integrations.HttpLambdaIntegration("AdminUsersInt", usersFn),
    });

    // ---------- Outputs ----------
    new CfnOutput(this, "WebBucketName", { value: webBucket.bucketName });
    new CfnOutput(this, "ImagesBucketName", { value: imagesBucket.bucketName });
    new CfnOutput(this, "CloudFrontDomain", { value: dist.distributionDomainName });
    new CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
    new CfnOutput(this, "CognitoDomainUrl", {
      value: `https://${domainPrefix}.auth.${this.region}.amazoncognito.com`,
});
    new CfnOutput(this, "CloudFrontDistributionId", { value: dist.distributionId });

  }
}
