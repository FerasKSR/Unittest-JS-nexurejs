#include <napi.h>
#include <string>
#include <vector>
#include <zlib.h>
#include "compression.h"

/**
 * Compression implementation
 * Provides fast compression/decompression using zlib
 */
namespace Compression {

  // Helper for gzip compression
  std::vector<uint8_t> gzipCompress(const uint8_t* data, size_t dataLength, int level = Z_DEFAULT_COMPRESSION) {
    z_stream zs;
    memset(&zs, 0, sizeof(zs));

    // Initialize deflate with gzip format
    if (deflateInit2(&zs, level, Z_DEFLATED, 16 + MAX_WBITS, 8, Z_DEFAULT_STRATEGY) != Z_OK) {
      return {};
    }

    // Set input data
    zs.next_in = const_cast<Bytef*>(data);
    zs.avail_in = static_cast<uInt>(dataLength);

    // Estimate output buffer size (usually compressed data is smaller)
    size_t outBufferSize = dataLength;
    if (dataLength > 1024) outBufferSize = dataLength / 2;

    std::vector<uint8_t> compressed;
    compressed.resize(outBufferSize);

    // Compress the data
    int ret;
    do {
      // If our output buffer is too small, increase its size
      if (zs.total_out >= compressed.size()) {
        compressed.resize(compressed.size() + dataLength / 2);
      }

      zs.next_out = compressed.data() + zs.total_out;
      zs.avail_out = static_cast<uInt>(compressed.size() - zs.total_out);

      ret = deflate(&zs, Z_FINISH);

    } while (ret == Z_OK);

    // Clean up
    deflateEnd(&zs);

    if (ret != Z_STREAM_END) {
      return {};
    }

    // Resize to actual compressed size
    compressed.resize(zs.total_out);
    return compressed;
  }

  // Helper for gzip decompression
  std::vector<uint8_t> gzipDecompress(const uint8_t* data, size_t dataLength) {
    z_stream zs;
    memset(&zs, 0, sizeof(zs));

    // Initialize inflate with gzip format
    if (inflateInit2(&zs, 16 + MAX_WBITS) != Z_OK) {
      return {};
    }

    // Set input data
    zs.next_in = const_cast<Bytef*>(data);
    zs.avail_in = static_cast<uInt>(dataLength);

    // Start with output buffer approximately twice the size of input
    size_t outBufferSize = dataLength * 2;

    std::vector<uint8_t> decompressed;
    decompressed.resize(outBufferSize);

    // Decompress the data
    int ret;
    do {
      // If our output buffer is too small, double its size
      if (zs.total_out >= decompressed.size()) {
        decompressed.resize(decompressed.size() * 2);
      }

      zs.next_out = decompressed.data() + zs.total_out;
      zs.avail_out = static_cast<uInt>(decompressed.size() - zs.total_out);

      ret = inflate(&zs, Z_FINISH);

      if (ret == Z_NEED_DICT || ret == Z_DATA_ERROR || ret == Z_MEM_ERROR) {
        inflateEnd(&zs);
        return {};
      }

    } while (ret != Z_STREAM_END && zs.avail_in > 0);

    // Clean up
    inflateEnd(&zs);

    // Resize to actual decompressed size
    decompressed.resize(zs.total_out);
    return decompressed;
  }

  // JavaScript bindings
  Napi::Value Compress(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || (!info[0].IsBuffer() && !info[0].IsString())) {
      Napi::TypeError::New(env, "Expected buffer or string").ThrowAsJavaScriptException();
      return env.Null();
    }

    int level = Z_DEFAULT_COMPRESSION;
    if (info.Length() > 1 && info[1].IsNumber()) {
      level = info[1].As<Napi::Number>().Int32Value();
      if (level < Z_NO_COMPRESSION || level > Z_BEST_COMPRESSION) {
        Napi::RangeError::New(env, "Compression level must be between 0 and 9").ThrowAsJavaScriptException();
        return env.Null();
      }
    }

    std::vector<uint8_t> input;
    size_t inputLength = 0;

    if (info[0].IsBuffer()) {
      Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();
      inputLength = buffer.Length();
      input.resize(inputLength);
      memcpy(input.data(), buffer.Data(), inputLength);
    } else {
      std::string str = info[0].As<Napi::String>().Utf8Value();
      inputLength = str.length();
      input.resize(inputLength);
      memcpy(input.data(), str.c_str(), inputLength);
    }

    std::vector<uint8_t> compressed = gzipCompress(input.data(), inputLength, level);

    if (compressed.empty()) {
      Napi::Error::New(env, "Compression failed").ThrowAsJavaScriptException();
      return env.Null();
    }

    return Napi::Buffer<uint8_t>::Copy(env, compressed.data(), compressed.size());
  }

  Napi::Value Decompress(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsBuffer()) {
      Napi::TypeError::New(env, "Expected buffer").ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();

    std::vector<uint8_t> decompressed = gzipDecompress(buffer.Data(), buffer.Length());

    if (decompressed.empty()) {
      Napi::Error::New(env, "Decompression failed").ThrowAsJavaScriptException();
      return env.Null();
    }

    // Output as buffer by default
    bool asString = false;
    if (info.Length() > 1 && info[1].IsBoolean()) {
      asString = info[1].As<Napi::Boolean>().Value();
    }

    if (asString) {
      return Napi::String::New(env, reinterpret_cast<char*>(decompressed.data()), decompressed.size());
    } else {
      return Napi::Buffer<uint8_t>::Copy(env, decompressed.data(), decompressed.size());
    }
  }

  Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("compress", Napi::Function::New(env, Compress));
    exports.Set("decompress", Napi::Function::New(env, Decompress));
    return exports;
  }

} // namespace Compression
