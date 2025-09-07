// infra/cdk/lib/core-stack.ts
import { Stack, StackProps, Duration, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamo from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class CoreStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const app = 'carshowroom';
    const stage = (this.node.tryGetContext('stage') ?? 'dev') as 'dev' | 'prod';

    // ---------- DynamoDB ----------
    const cars = new dynamo.Table(this, 'Cars', {
      tableName: `${stage}-cars`,
      partitionKey: { name: 'carId', type: dynamo.AttributeType.STRING },
      billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const users = new dynamo.Table(this, 'Users', {
      tableName: `${stage}-users`,
      partitionKey: { name: 'userId', type: dynamo.AttributeType.STRING },
      billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const bookings = new dynamo.Table(this, 'Bookings', {
      tableName: `${stage}-bookings`,
      partitionKey: { name: 'bookingId', type: dynamo.AttributeType.STRING },
      billingMode: dynamo.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // GSI for /bookings/me (query by userId, order by slotTime)
    bookings.addGlobalSecondaryIndex({
      indexName: 'user-index',
      partitionKey: { name: 'userId', type: dynamo.AttributeType.STRING },
      sortKey: { name: 'slotTime', type: dynamo.AttributeType.STRING },
    });

    // ---------- Cognito ----------
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${app}-${stage}-user-pool`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      passwordPolicy: { minLength: 8, requireLowercase: true, requireUppercase: true, requireDigits: true },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const userClient = new cognito.UserPoolClient(this, 'UserClient', {
      userPool,
      userPoolClientName: `${app}-${stage}-user-client`,
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
    });

    new cognito.CfnUserPoolGroup(this, 'AdminGroup', { groupName: 'admin', userPoolId: userPool.userPoolId });
    new cognito.CfnUserPoolGroup(this, 'CustomerGroup', { groupName: 'customer', userPoolId: userPool.userPoolId });

    // ---------- S3 ----------
    const webBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: `${app}-${stage}-web`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const imagesBucket = new s3.Bucket(this, 'ImagesBucket', {
      bucketName: `${app}-${stage}-images`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ---------- CloudFront ----------
    const webOrigin = origins.S3BucketOrigin.withOriginAccessControl(webBucket);
    const imagesOrigin = origins.S3BucketOrigin.withOriginAccessControl(imagesBucket);

    const dist = new cloudfront.Distribution(this, 'WebDist', {
      comment: `${app}-${stage}-distribution`,
      defaultBehavior: { origin: webOrigin },
      additionalBehaviors: { '/images/*': { origin: imagesOrigin } },
    });

    // ---------- Lambda: Cars service (router) ----------
    const carFn = new lambda.Function(this, 'CarFn', {
      functionName: `${stage}-car-service`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../../apps/services/cars/dist'),
      timeout: Duration.seconds(10),
      environment: {
        CARS_TABLE: cars.tableName,
        IMAGES_BUCKET: imagesBucket.bucketName,
      },
    });
    cars.grantReadWriteData(carFn);
    imagesBucket.grantReadWrite(carFn);

    // ---------- Lambda: Bookings service (router) ----------
    const bookingFn = new lambda.Function(this, 'BookingFn', {
      functionName: `${stage}-booking-service`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../../apps/services/bookings/dist'),
      timeout: Duration.seconds(10),
      environment: {
        BOOKINGS_TABLE: bookings.tableName,
      },
    });
    bookings.grantReadWriteData(bookingFn);

    // ---------- HTTP API + Routes ----------
    const httpApi = new apigwv2.HttpApi(this, 'Api', {
      apiName: `${app}-${stage}-api`,
      corsPreflight: {
        allowHeaders: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.ANY],
        allowOrigins: ['*'],
      },
    });

    // Cognito JWT authorizer
    const jwtAuthorizer = new authorizers.HttpUserPoolAuthorizer('JwtAuth', userPool, {
      userPoolClients: [userClient],
    });

    // Cars routes (public browse, protected admin writes)
    const listCarsIntegration   = new integrations.HttpLambdaIntegration('ListCars',   carFn);
    const getCarIntegration     = new integrations.HttpLambdaIntegration('GetCar',     carFn);
    const createCarIntegration  = new integrations.HttpLambdaIntegration('CreateCar',  carFn);
    const updateCarIntegration  = new integrations.HttpLambdaIntegration('UpdateCar',  carFn);
    const deleteCarIntegration  = new integrations.HttpLambdaIntegration('DeleteCar',  carFn);
    const uploadUrlIntegration  = new integrations.HttpLambdaIntegration('ImageURL',   carFn);

    httpApi.addRoutes({ path: '/cars',      methods: [apigwv2.HttpMethod.GET],  integration: listCarsIntegration });
    httpApi.addRoutes({ path: '/cars/{id}', methods: [apigwv2.HttpMethod.GET],  integration: getCarIntegration   });

    httpApi.addRoutes({
      path: '/cars',
      methods: [apigwv2.HttpMethod.POST],
      authorizer: jwtAuthorizer,
      integration: createCarIntegration,
    });
    httpApi.addRoutes({
      path: '/cars/{id}',
      methods: [apigwv2.HttpMethod.PUT],
      authorizer: jwtAuthorizer,
      integration: updateCarIntegration,
    });
    httpApi.addRoutes({
      path: '/cars/{id}',
      methods: [apigwv2.HttpMethod.DELETE],
      authorizer: jwtAuthorizer,
      integration: deleteCarIntegration,
    });
    httpApi.addRoutes({
      path: '/cars/{id}/image-upload-url',
      methods: [apigwv2.HttpMethod.POST],
      authorizer: jwtAuthorizer,
      integration: uploadUrlIntegration,
    });

    // Bookings routes (all protected)
    const createBookingIntegration = new integrations.HttpLambdaIntegration('CreateBooking', bookingFn);
    const myBookingsIntegration    = new integrations.HttpLambdaIntegration('MyBookings',   bookingFn);
    const updateBookingIntegration = new integrations.HttpLambdaIntegration('UpdateBooking', bookingFn);

    httpApi.addRoutes({
      path: '/bookings',
      methods: [apigwv2.HttpMethod.POST],
      authorizer: jwtAuthorizer,
      integration: createBookingIntegration,
    });
    httpApi.addRoutes({
      path: '/bookings/me',
      methods: [apigwv2.HttpMethod.GET],
      authorizer: jwtAuthorizer,
      integration: myBookingsIntegration,
    });
    httpApi.addRoutes({
      path: '/bookings/{id}',
      methods: [apigwv2.HttpMethod.PATCH],
      authorizer: jwtAuthorizer,
      integration: updateBookingIntegration,
    });

    // ---------- Outputs ----------
    new CfnOutput(this, 'WebBucketName', { value: webBucket.bucketName });
    new CfnOutput(this, 'ImagesBucketName', { value: imagesBucket.bucketName });
    new CfnOutput(this, 'CloudFrontDomain', { value: dist.distributionDomainName });
    new CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
  }
}
