package expo.modules.swipelymedia

import android.app.Activity
import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SwipelyMediaDeleteModule : Module() {
  companion object {
    private const val DELETE_REQUEST_CODE = 47261
  }

  private var pendingPromise: Promise? = null

  private val context: Context
    get() = appContext.reactContext ?: error("React context is unavailable")

  override fun definition() = ModuleDefinition {
    Name("SwipelyMediaDelete")

    AsyncFunction("deleteMediaByPath") { path: String, promise: Promise ->
      if (pendingPromise != null) {
        promise.reject("E_DELETE_BUSY", "Another media deletion is awaiting Android authorization.", null)
        return@AsyncFunction
      }

      val mediaUri = findMediaUri(path)
      if (mediaUri == null) {
        promise.resolve(false)
        return@AsyncFunction
      }

      val resolver = context.contentResolver
      try {
        if (resolver.delete(mediaUri, null, null) > 0) {
          promise.resolve(true)
          return@AsyncFunction
        }
      } catch (_: SecurityException) {
        // Android 11+ may require a user-approved MediaStore delete request.
      } catch (_: UnsupportedOperationException) {
        // Fall through to the system delete request where available.
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val activity = appContext.activityProvider?.currentActivity
        if (activity == null) {
          promise.reject("E_NO_ACTIVITY", "No foreground Android activity is available for media deletion authorization.", null)
          return@AsyncFunction
        }

        try {
          val request = MediaStore.createDeleteRequest(resolver, listOf(mediaUri))
          pendingPromise = promise
          activity.startIntentSenderForResult(
            request.intentSender,
            DELETE_REQUEST_CODE,
            null,
            0,
            0,
            0
          )
          return@AsyncFunction
        } catch (error: Exception) {
          pendingPromise = null
          promise.reject("E_DELETE_REQUEST", "Could not start Android media deletion authorization.", error)
          return@AsyncFunction
        }
      }

      promise.resolve(false)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != DELETE_REQUEST_CODE) return@OnActivityResult
      val promise = pendingPromise
      pendingPromise = null
      promise?.resolve(payload.resultCode == Activity.RESULT_OK)
    }
  }

  private fun findMediaUri(rawPath: String): Uri? {
    val targetPath = Uri.parse(rawPath).path ?: rawPath
    val resolver = context.contentResolver
    val fileName = targetPath.substringAfterLast('/')
    val relativePath = relativePathFor(targetPath)

    // Android 11+ exposes RELATIVE_PATH/DISPLAY_NAME for scoped-storage media.
    // Prefer this lookup instead of relying on the legacy DATA column.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      val imageUri = findInCollection(
        resolver,
        MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
        fileName,
        relativePath
      )
      if (imageUri != null) return imageUri

      val videoUri = findInCollection(
        resolver,
        MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
        fileName,
        relativePath
      )
      if (videoUri != null) return videoUri
    }

    // Legacy fallback for older Android/provider implementations.
    val collection = MediaStore.Files.getContentUri("external")
    val projection = arrayOf(
      MediaStore.Files.FileColumns._ID,
      MediaStore.Files.FileColumns.MEDIA_TYPE
    )

    return try {
      resolver.query(
        collection,
        projection,
        "${MediaStore.Files.FileColumns.DATA} = ?",
        arrayOf(targetPath),
        null
      )?.use { cursor ->
        if (!cursor.moveToFirst()) return@use null
        val id = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID))
        val mediaType = cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MEDIA_TYPE))
        when (mediaType) {
          MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE ->
            ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id)
          MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO ->
            ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id)
          else -> ContentUris.withAppendedId(collection, id)
        }
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun findInCollection(
    resolver: android.content.ContentResolver,
    collection: Uri,
    fileName: String,
    relativePath: String
  ): Uri? {
    val projection = arrayOf(MediaStore.MediaColumns._ID)

    return try {
      resolver.query(
        collection,
        projection,
        "${MediaStore.MediaColumns.DISPLAY_NAME} = ? AND ${MediaStore.MediaColumns.RELATIVE_PATH} = ?",
        arrayOf(fileName, relativePath),
        null
      )?.use { cursor ->
        if (!cursor.moveToFirst()) null
        else ContentUris.withAppendedId(
          collection,
          cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID))
        )
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun relativePathFor(path: String): String {
    val normalized = path.removePrefix("/storage/emulated/0/").removePrefix("/")
    val slash = normalized.lastIndexOf('/')
    if (slash < 0) return ""
    return normalized.substring(0, slash + 1)
  }
}
