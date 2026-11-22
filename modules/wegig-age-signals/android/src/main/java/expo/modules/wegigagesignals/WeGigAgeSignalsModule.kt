package expo.modules.wegigagesignals

import com.google.android.play.agesignals.AgeSignalsManagerFactory
import com.google.android.play.agesignals.ApplicableAgeFeaturesRequest
import com.google.android.play.agesignals.model.ApplicableAgeFeature
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.exception.toCodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WeGigAgeSignalsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WeGigAgeSignals")

    AsyncFunction("isMandatorySharingAsync") { promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val manager = AgeSignalsManagerFactory.create(context.applicationContext)

      manager.getApplicableAgeFeatures(ApplicableAgeFeaturesRequest.builder().build())
        .addOnSuccessListener { result ->
          promise.resolve(result.features().contains(ApplicableAgeFeature.MANDATORY_SHARING))
        }
        .addOnFailureListener { error -> promise.reject(error.toCodedException()) }
        .addOnCanceledListener { promise.reject("AGE_CHECK_CANCELLED", "The age eligibility check was cancelled.", null) }
    }
  }
}
