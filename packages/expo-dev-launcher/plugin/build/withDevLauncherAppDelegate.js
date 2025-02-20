"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withDevLauncherAppDelegate = exports.modifyAppDelegate = exports.modifyLegacyAppDelegate = void 0;
const config_plugins_1 = require("@expo/config-plugins");
const semver_1 = __importDefault(require("semver"));
const constants_1 = require("./constants");
const resolveExpoUpdatesVersion_1 = require("./resolveExpoUpdatesVersion");
const utils_1 = require("./utils");
function escapeRegExpCharacters(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const INITIALIZE_REACT_NATIVE_APP_FUNCTION = `- (RCTBridge *)initializeReactNativeApp`;
const NEW_INITIALIZE_REACT_NATIVE_APP_FUNCTION = `- (RCTBridge *)initializeReactNativeApp:(NSDictionary *)launchOptions`;
const DEV_LAUNCHER_APP_DELEGATE_SOURCE_FOR_URL = `  #if defined(EX_DEV_LAUNCHER_ENABLED)
  return [[EXDevLauncherController sharedInstance] sourceUrl];
  #else
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index" fallbackResource:nil];
  #endif`;
const DEV_LAUNCHER_APP_DELEGATE_ON_DEEP_LINK = `#if defined(EX_DEV_LAUNCHER_ENABLED)
  if ([EXDevLauncherController.sharedInstance onDeepLink:url options:options]) {
    return true;
  }
  #endif
  return [RCTLinkingManager application:application openURL:url options:options];`;
const DEV_LAUNCHER_APP_DELEGATE_IOS_IMPORT = `
#if defined(EX_DEV_LAUNCHER_ENABLED)
#include <EXDevLauncher/EXDevLauncherController.h>
#endif`;
const DEV_LAUNCHER_UPDATES_APP_DELEGATE_IOS_IMPORT = `
#if defined(EX_DEV_LAUNCHER_ENABLED)
#include <EXDevLauncher/EXDevLauncherController.h>
#import <EXUpdates/EXUpdatesDevLauncherController.h>
#endif`;
const DEV_LAUNCHER_APP_DELEGATE_CONTROLLER_DELEGATE_LEGACY = `
#if defined(EX_DEV_LAUNCHER_ENABLED)
@implementation AppDelegate (EXDevLauncherControllerDelegate)

- (void)devLauncherController:(EXDevLauncherController *)developmentClientController
    didStartWithSuccess:(BOOL)success
{
  developmentClientController.appBridge = [self initializeReactNativeApp];
  EXSplashScreenService *splashScreenService = (EXSplashScreenService *)[UMModuleRegistryProvider getSingletonModuleForClass:[EXSplashScreenService class]];
  [splashScreenService showSplashScreenFor:self.window.rootViewController];
}

@end
#endif
`;
const DEV_LAUNCHER_APP_DELEGATE_CONTROLLER_DELEGATE = `
#if defined(EX_DEV_LAUNCHER_ENABLED)
@implementation AppDelegate (EXDevLauncherControllerDelegate)

- (void)devLauncherController:(EXDevLauncherController *)developmentClientController
    didStartWithSuccess:(BOOL)success
{
  developmentClientController.appBridge = [self initializeReactNativeApp:[EXDevLauncherController.sharedInstance getLaunchOptions]];
}

@end
#endif
`;
const DEV_LAUNCHER_APP_DELEGATE_INIT = `#if defined(EX_DEV_LAUNCHER_ENABLED)
        EXDevLauncherController *controller = [EXDevLauncherController sharedInstance];
        [controller startWithWindow:self.window delegate:(id<EXDevLauncherControllerDelegate>)self launchOptions:launchOptions];
      #else
        [self initializeReactNativeApp];
      #endif`;
const DEV_LAUNCHER_UPDATES_APP_DELEGATE_INIT = `EXDevLauncherController *controller = [EXDevLauncherController sharedInstance];
        controller.updatesInterface = [EXUpdatesDevLauncherController sharedInstance];`;
const DEV_LAUNCHER_APP_DELEGATE_BRIDGE = `#if defined(EX_DEV_LAUNCHER_ENABLED)
    NSDictionary *launchOptions = [EXDevLauncherController.sharedInstance getLaunchOptions];
  #else
    NSDictionary *launchOptions = self.launchOptions;
  #endif
  
    RCTBridge *bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:launchOptions];`;
const DEV_MENU_IMPORT = `@import EXDevMenu;`;
const DEV_MENU_IOS_INIT = `
#if defined(EX_DEV_MENU_ENABLED)
  [DevMenuManager configureWithBridge:bridge];
#endif`;
const DEV_LAUNCHER_INIT_TO_REMOVE = new RegExp(escapeRegExpCharacters(`RCTBridge *bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:launchOptions];
  RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge moduleName:@"main" initialProperties:nil];
  id rootViewBackgroundColor = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"RCTRootViewBackgroundColor"];
  if (rootViewBackgroundColor != nil) {
    rootView.backgroundColor = [RCTConvert UIColor:rootViewBackgroundColor];
  } else {
    rootView.backgroundColor = [UIColor whiteColor];
  }

  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  UIViewController *rootViewController = `) +
    `([^;]+)` +
    escapeRegExpCharacters(`;
  rootViewController.view = rootView;
  self.window.rootViewController = rootViewController;
  [self.window makeKeyAndVisible];`), 'm');
const DEV_LAUNCHER_INIT_TO_REMOVE_SDK_44 = new RegExp(escapeRegExpCharacters(`RCTBridge *bridge = [self.reactDelegate createBridgeWithDelegate:self launchOptions:launchOptions];
  RCTRootView *rootView = [self.reactDelegate createRootViewWithBridge:bridge moduleName:@"main" initialProperties:nil];
  rootView.backgroundColor = [UIColor whiteColor];
  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  UIViewController *rootViewController = `) +
    `([^;]+)` +
    escapeRegExpCharacters(`;
  rootViewController.view = rootView;
  self.window.rootViewController = rootViewController;
  [self.window makeKeyAndVisible];`), 'm');
const DEV_LAUNCHER_NEW_INIT = `self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
#if defined(EX_DEV_LAUNCHER_ENABLED)
  EXDevLauncherController *controller = [EXDevLauncherController sharedInstance];
  [controller startWithWindow:self.window delegate:(id<EXDevLauncherControllerDelegate>)self launchOptions:launchOptions];
#else
  [self initializeReactNativeApp:launchOptions];
#endif`;
const DEV_LAUNCHER_INITIALIZE_REACT_NATIVE_APP_FUNCTION_DEFINITION_REGEX = new RegExp(escapeRegExpCharacters(`
- (RCTBridge *)initializeReactNativeApp:(NSDictionary *)launchOptions
{
  RCTBridge *bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:launchOptions];
  RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge moduleName:@"main" initialProperties:nil];
  id rootViewBackgroundColor = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"RCTRootViewBackgroundColor"];
  if (rootViewBackgroundColor != nil) {
    rootView.backgroundColor = [RCTConvert UIColor:rootViewBackgroundColor];
  } else {
    rootView.backgroundColor = [UIColor whiteColor];
  }

  UIViewController *rootViewController = `) +
    `[^;]+` +
    escapeRegExpCharacters(`;
  rootViewController.view = rootView;
  self.window.rootViewController = rootViewController;
  [self.window makeKeyAndVisible];

  return bridge;
}
`), 'm');
const DEV_LAUNCHER_INITIALIZE_REACT_NATIVE_APP_FUNCTION_DEFINITION = (viewControllerInit) => `
- (RCTBridge *)initializeReactNativeApp:(NSDictionary *)launchOptions
{
  RCTBridge *bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:launchOptions];
  RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge moduleName:@"main" initialProperties:nil];
  id rootViewBackgroundColor = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"RCTRootViewBackgroundColor"];
  if (rootViewBackgroundColor != nil) {
    rootView.backgroundColor = [RCTConvert UIColor:rootViewBackgroundColor];
  } else {
    rootView.backgroundColor = [UIColor whiteColor];
  }

  UIViewController *rootViewController = ${viewControllerInit !== null && viewControllerInit !== void 0 ? viewControllerInit : '[UIViewController new]'};
  rootViewController.view = rootView;
  self.window.rootViewController = rootViewController;
  [self.window makeKeyAndVisible];

  return bridge;
}
`;
const DEV_LAUNCHER_INITIALIZE_REACT_NATIVE_APP_FUNCTION_DEFINITION_SDK_44 = `
- (RCTBridge *)initializeReactNativeApp:(NSDictionary *)launchOptions
{
  RCTBridge *bridge = [self.reactDelegate createBridgeWithDelegate:self launchOptions:launchOptions];
  RCTRootView *rootView = [self.reactDelegate createRootViewWithBridge:bridge moduleName:@"main" initialProperties:nil];
  rootView.backgroundColor = [UIColor whiteColor];
  UIViewController *rootViewController = [self.reactDelegate createRootViewController];
  rootViewController.view = rootView;
  self.window.rootViewController = rootViewController;
  [self.window makeKeyAndVisible];

  return bridge;
 }
`;
function addImports(appDelegate, shouldAddUpdatesIntegration) {
    if (!appDelegate.includes(DEV_LAUNCHER_APP_DELEGATE_IOS_IMPORT) &&
        !appDelegate.includes(DEV_LAUNCHER_UPDATES_APP_DELEGATE_IOS_IMPORT)) {
        const lines = appDelegate.split('\n');
        lines.splice(1, 0, shouldAddUpdatesIntegration
            ? DEV_LAUNCHER_UPDATES_APP_DELEGATE_IOS_IMPORT
            : DEV_LAUNCHER_APP_DELEGATE_IOS_IMPORT);
        appDelegate = lines.join('\n');
    }
    return appDelegate;
}
function removeDevMenuInit(appDelegate) {
    if (!appDelegate.includes(DEV_MENU_IMPORT)) {
        // expo-dev-launcher is responsible for initializing the expo-dev-menu.
        // We need to remove init block from AppDelegate.
        appDelegate = appDelegate.replace(DEV_MENU_IOS_INIT, '');
    }
    return appDelegate;
}
function addDeepLinkHandler(appDelegate) {
    if (!appDelegate.includes(DEV_LAUNCHER_APP_DELEGATE_ON_DEEP_LINK)) {
        appDelegate = appDelegate.replace('return [RCTLinkingManager application:application openURL:url options:options];', DEV_LAUNCHER_APP_DELEGATE_ON_DEEP_LINK);
    }
    return appDelegate;
}
function changeDebugURL(appDelegate) {
    if (!appDelegate.includes(DEV_LAUNCHER_APP_DELEGATE_SOURCE_FOR_URL)) {
        appDelegate = appDelegate.replace('return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index" fallbackResource:nil];', DEV_LAUNCHER_APP_DELEGATE_SOURCE_FOR_URL);
    }
    return appDelegate;
}
function modifyLegacyAppDelegate(appDelegate, expoUpdatesVersion = null) {
    const shouldAddUpdatesIntegration = expoUpdatesVersion != null && semver_1.default.gt(expoUpdatesVersion, '0.6.0');
    appDelegate = addImports(appDelegate, shouldAddUpdatesIntegration);
    if (!appDelegate.includes(DEV_LAUNCHER_APP_DELEGATE_INIT)) {
        appDelegate = appDelegate.replace(/(didFinishLaunchingWithOptions([^}])*)\[self initializeReactNativeApp\];(([^}])*})/, `$1${DEV_LAUNCHER_APP_DELEGATE_INIT}$3`);
    }
    if (shouldAddUpdatesIntegration &&
        !appDelegate.includes(DEV_LAUNCHER_UPDATES_APP_DELEGATE_INIT)) {
        appDelegate = appDelegate.replace('EXDevLauncherController *controller = [EXDevLauncherController sharedInstance];', DEV_LAUNCHER_UPDATES_APP_DELEGATE_INIT);
    }
    if (!appDelegate.includes(DEV_LAUNCHER_APP_DELEGATE_BRIDGE)) {
        appDelegate = appDelegate.replace('RCTBridge *bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:self.launchOptions];', DEV_LAUNCHER_APP_DELEGATE_BRIDGE);
    }
    appDelegate = changeDebugURL(appDelegate);
    appDelegate = addDeepLinkHandler(appDelegate);
    if (!appDelegate.includes(DEV_LAUNCHER_APP_DELEGATE_CONTROLLER_DELEGATE_LEGACY)) {
        appDelegate += DEV_LAUNCHER_APP_DELEGATE_CONTROLLER_DELEGATE_LEGACY;
    }
    appDelegate = removeDevMenuInit(appDelegate);
    return appDelegate;
}
exports.modifyLegacyAppDelegate = modifyLegacyAppDelegate;
function modifyAppDelegate(appDelegate, expoUpdatesVersion = null) {
    const shouldAddUpdatesIntegration = expoUpdatesVersion != null && semver_1.default.gt(expoUpdatesVersion, '0.6.0');
    if (!DEV_LAUNCHER_INITIALIZE_REACT_NATIVE_APP_FUNCTION_DEFINITION_REGEX.test(appDelegate) &&
        !appDelegate.includes(DEV_LAUNCHER_INITIALIZE_REACT_NATIVE_APP_FUNCTION_DEFINITION_SDK_44)) {
        let initToRemove;
        let shouldAddSDK44Init = false;
        if (DEV_LAUNCHER_INIT_TO_REMOVE_SDK_44.test(appDelegate)) {
            initToRemove = DEV_LAUNCHER_INIT_TO_REMOVE_SDK_44;
            shouldAddSDK44Init = true;
        }
        else if (DEV_LAUNCHER_INIT_TO_REMOVE.test(appDelegate)) {
            initToRemove = DEV_LAUNCHER_INIT_TO_REMOVE;
        }
        if (initToRemove) {
            // UIViewController can be initialized differently depending on whether expo-screen-orientation is installed,
            // so we need to preserve whatever is there already.
            let viewControllerInit;
            appDelegate = appDelegate.replace(initToRemove, (match, p1) => {
                viewControllerInit = p1;
                return DEV_LAUNCHER_NEW_INIT;
            });
            const initToAdd = shouldAddSDK44Init
                ? DEV_LAUNCHER_INITIALIZE_REACT_NATIVE_APP_FUNCTION_DEFINITION_SDK_44
                : DEV_LAUNCHER_INITIALIZE_REACT_NATIVE_APP_FUNCTION_DEFINITION(viewControllerInit);
            appDelegate = (0, utils_1.addLines)(appDelegate, '@implementation AppDelegate', 1, [initToAdd]);
        }
        else {
            config_plugins_1.WarningAggregator.addWarningIOS('expo-dev-launcher', `Failed to modify AppDelegate init function. 
See the expo-dev-client installation instructions to modify your AppDelegate manually: ${constants_1.InstallationPage}`);
        }
    }
    if (shouldAddUpdatesIntegration &&
        !appDelegate.includes(DEV_LAUNCHER_UPDATES_APP_DELEGATE_INIT)) {
        appDelegate = appDelegate.replace('EXDevLauncherController *controller = [EXDevLauncherController sharedInstance];', DEV_LAUNCHER_UPDATES_APP_DELEGATE_INIT);
    }
    appDelegate = addImports(appDelegate, shouldAddUpdatesIntegration);
    if (!appDelegate.includes(DEV_LAUNCHER_APP_DELEGATE_CONTROLLER_DELEGATE)) {
        appDelegate += DEV_LAUNCHER_APP_DELEGATE_CONTROLLER_DELEGATE;
    }
    if (!appDelegate.includes(DEV_LAUNCHER_APP_DELEGATE_ON_DEEP_LINK)) {
        appDelegate = appDelegate.replace('return [RCTLinkingManager application:application openURL:url options:options];', DEV_LAUNCHER_APP_DELEGATE_ON_DEEP_LINK);
    }
    appDelegate = changeDebugURL(appDelegate);
    appDelegate = removeDevMenuInit(appDelegate);
    return appDelegate;
}
exports.modifyAppDelegate = modifyAppDelegate;
const withDevLauncherAppDelegate = (config) => {
    return (0, config_plugins_1.withAppDelegate)(config, (config) => {
        if (config.modResults.language === 'objc') {
            let expoUpdatesVersion;
            try {
                expoUpdatesVersion = (0, resolveExpoUpdatesVersion_1.resolveExpoUpdatesVersion)(config.modRequest.projectRoot);
            }
            catch (e) {
                config_plugins_1.WarningAggregator.addWarningIOS('expo-dev-launcher', `Failed to check compatibility with expo-updates - ${e}`);
            }
            if (config.modResults.contents.includes(INITIALIZE_REACT_NATIVE_APP_FUNCTION) &&
                !config.modResults.contents.includes(NEW_INITIALIZE_REACT_NATIVE_APP_FUNCTION)) {
                config.modResults.contents = modifyLegacyAppDelegate(config.modResults.contents, expoUpdatesVersion);
            }
            else {
                config.modResults.contents = modifyAppDelegate(config.modResults.contents, expoUpdatesVersion);
            }
        }
        else {
            config_plugins_1.WarningAggregator.addWarningIOS('expo-dev-launcher', `Swift AppDelegate files are not supported yet.
See the expo-dev-client installation instructions to modify your AppDelegate manually: ${constants_1.InstallationPage}`);
        }
        return config;
    });
};
exports.withDevLauncherAppDelegate = withDevLauncherAppDelegate;
