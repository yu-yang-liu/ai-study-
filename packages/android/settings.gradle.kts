pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // compose-markdown is published on JitPack under com.github.jeziellago.
        maven(url = "https://jitpack.io")
    }
}

rootProject.name = "ai-study-android"

include(":apicontracts")
include(":corekit")
include(":app")
